import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { spawn } from 'child_process'

const isDev = !app.isPackaged

// ── Settings (persisted to JSON) ──────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(data: Record<string, unknown>) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

// ── Helpers ───────────────────────────────────────────────────
function fetchJson(url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(parsed, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function downloadFile(url: string, dest: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const doRequest = (targetUrl: string) => {
      const parsed = new URL(targetUrl)
      const mod = parsed.protocol === 'https:' ? https : http
      mod.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location)
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve(dest) })
      }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err) })
    }
    doRequest(url)
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── IPC Handlers ──────────────────────────────────────────────

function registerIpcHandlers() {
  // Settings
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_, data: Record<string, unknown>) => {
    saveSettings(data)
    return true
  })

  // File dialogs
  ipcMain.handle('dialog:openFile', async (_, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_, defaultName: string, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('shell:openPath', (_, p: string) => shell.openPath(p))

  // ── xAI Image Generation ───────────────────────────────────
  ipcMain.handle('xai:generateImage', async (_, opts: {
    apiKey: string
    prompt: string
    n?: number
    aspectRatio?: string
    resolution?: string
  }) => {
    const body: Record<string, unknown> = {
      model: 'grok-imagine-image',
      prompt: opts.prompt,
    }
    if (opts.n) body.n = opts.n
    if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio
    if (opts.resolution) body.resolution = opts.resolution

    const res = await fetchJson('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    }) as { data?: Array<{ url: string }> }

    return res
  })

  // ── xAI Video Generation (async polling) ────────────────────
  ipcMain.handle('xai:generateVideo', async (event, opts: {
    apiKey: string
    prompt: string
    duration?: number
    aspectRatio?: string
    resolution?: string
    imageUrl?: string
  }) => {
    const body: Record<string, unknown> = {
      model: 'grok-imagine-video',
      prompt: opts.prompt,
    }
    if (opts.duration) body.duration = opts.duration
    if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio
    if (opts.resolution) body.resolution = opts.resolution
    if (opts.imageUrl) body.image = { url: opts.imageUrl }

    const startRes = await fetchJson('https://api.x.ai/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    }) as { request_id?: string; error?: unknown }

    if (!startRes.request_id) {
      return { status: 'failed', error: startRes }
    }

    const requestId = startRes.request_id

    // Poll until done
    for (let i = 0; i < 120; i++) {
      await sleep(5000)

      const poll = await fetchJson(`https://api.x.ai/v1/videos/${requestId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${opts.apiKey}` },
      }) as { status: string; video?: { url: string; duration: number }; error?: unknown }

      // Send progress to renderer
      event.sender.send('xai:videoProgress', {
        requestId,
        status: poll.status,
        attempt: i + 1,
      })

      if (poll.status === 'done') {
        return { status: 'done', video: poll.video }
      }
      if (poll.status === 'failed' || poll.status === 'expired') {
        return { status: poll.status, error: poll.error }
      }
    }

    return { status: 'timeout' }
  })

  // ── Download URL to local file ──────────────────────────────
  ipcMain.handle('file:download', async (_, url: string, dest: string) => {
    await downloadFile(url, dest)
    return dest
  })

  ipcMain.handle('file:readAsDataUrl', async (_, filePath: string) => {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4',
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  ipcMain.handle('file:readJson', async (_, filePath: string) => {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  })

  // ── Sprite Sheet Generation (calls Python) ──────────────────
  ipcMain.handle('sprite:generate', async (event, opts: {
    videoPath: string
    outputDir: string
    fps?: number
    bgColor?: string
    tolerance?: number
    columns?: number
    padding?: number
    noTrim?: boolean
    exportFrames?: boolean
  }) => {
    return new Promise((resolve, reject) => {
      // Locate the Python script
      const scriptDir = isDev
        ? path.join(__dirname, '..', 'python')
        : path.join(process.resourcesPath, 'python')
      const scriptPath = path.join(scriptDir, 'main.py')

      // Resolve Python binary: prefer venv, then bundled libs + system python
      const isWin = process.platform === 'win32'
      const venvPython = isWin
        ? path.join(scriptDir, 'venv', 'Scripts', 'python.exe')
        : path.join(scriptDir, 'venv', 'bin', 'python3')
      const fallbackPython = isWin ? 'python' : 'python3'

      // Check if venv python is a valid file (not a broken symlink)
      let pythonBin = fallbackPython
      try {
        if (fs.existsSync(venvPython) && fs.statSync(fs.realpathSync(venvPython))) {
          pythonBin = venvPython
        }
      } catch {
        // Broken symlink or missing — use fallback
      }

      // Set PYTHONPATH to bundled libs directory if it exists
      const libsDir = path.join(scriptDir, 'libs')
      const env = { ...process.env }
      if (fs.existsSync(libsDir)) {
        env.PYTHONPATH = libsDir + (env.PYTHONPATH ? (isWin ? ';' : ':') + env.PYTHONPATH : '')
      }

      // Ensure common tool paths are in PATH (packaged app may not inherit shell PATH)
      if (!isWin) {
        const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
        const currentPath = env.PATH || ''
        const missingPaths = extraPaths.filter(p => !currentPath.includes(p))
        if (missingPaths.length > 0) {
          env.PATH = currentPath + ':' + missingPaths.join(':')
        }
      }

      const args = [scriptPath, opts.videoPath, '-o', opts.outputDir]
      if (opts.fps) args.push('--fps', String(opts.fps))
      if (opts.bgColor) args.push('--bg-color', opts.bgColor)
      if (opts.tolerance) args.push('--tolerance', String(opts.tolerance))
      if (opts.columns) args.push('--columns', String(opts.columns))
      if (opts.padding) args.push('--padding', String(opts.padding))
      if (opts.noTrim) args.push('--no-trim')
      if (opts.exportFrames) args.push('--export-frames')

      const proc = spawn(pythonBin, args, {
        cwd: scriptDir,
        env,
      })
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        event.sender.send('sprite:progress', text)
      })

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          // Find the output files
          const videoName = path.basename(opts.videoPath, path.extname(opts.videoPath))
          const outDir = path.join(opts.outputDir, videoName)
          const spritePng = path.join(outDir, `${videoName}_sprite.png`)
          const spriteJson = path.join(outDir, `${videoName}_sprite.json`)
          resolve({
            success: true,
            spritePng: fs.existsSync(spritePng) ? spritePng : null,
            spriteJson: fs.existsSync(spriteJson) ? spriteJson : null,
            outputDir: outDir,
            stdout,
          })
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`))
        }
      })

      proc.on('error', reject)
    })
  })
}

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Sprite Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
