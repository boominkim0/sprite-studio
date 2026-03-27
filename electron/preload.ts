import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data: Record<string, unknown>) => ipcRenderer.invoke('settings:save', data),

  // Dialogs
  openFile: (filters?: Array<{ name: string; extensions: string[] }>) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (defaultName: string, filters?: Array<{ name: string; extensions: string[] }>) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),

  // Files
  downloadFile: (url: string, dest: string) => ipcRenderer.invoke('file:download', url, dest),
  readAsDataUrl: (filePath: string) => ipcRenderer.invoke('file:readAsDataUrl', filePath),
  readJson: (filePath: string) => ipcRenderer.invoke('file:readJson', filePath),

  // xAI
  generateImage: (opts: {
    apiKey: string; prompt: string;
    n?: number; aspectRatio?: string; resolution?: string
  }) => ipcRenderer.invoke('xai:generateImage', opts),

  generateVideo: (opts: {
    apiKey: string; prompt: string;
    duration?: number; aspectRatio?: string; resolution?: string;
    imageUrl?: string
  }) => ipcRenderer.invoke('xai:generateVideo', opts),

  onVideoProgress: (cb: (data: { requestId: string; status: string; attempt: number }) => void) => {
    const listener = (_: unknown, data: { requestId: string; status: string; attempt: number }) => cb(data)
    ipcRenderer.on('xai:videoProgress', listener)
    return () => ipcRenderer.removeListener('xai:videoProgress', listener)
  },

  // Sprite
  generateSprite: (opts: {
    videoPath: string; outputDir: string;
    fps?: number; bgColor?: string; tolerance?: number;
    columns?: number; padding?: number; noTrim?: boolean;
    exportFrames?: boolean
  }) => ipcRenderer.invoke('sprite:generate', opts),

  onSpriteProgress: (cb: (msg: string) => void) => {
    const listener = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on('sprite:progress', listener)
    return () => ipcRenderer.removeListener('sprite:progress', listener)
  },
})
