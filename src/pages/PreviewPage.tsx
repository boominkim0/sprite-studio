import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, FolderOpen, ImageIcon } from 'lucide-react'

interface SpriteFrame {
  index: number
  filename: string
  frame: { x: number; y: number; w: number; h: number }
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
  trimmed: boolean
}

interface SpriteMeta {
  image: string
  size: { w: number; h: number }
  columns: number
  rows: number
  frame_count: number
  cell_width: number
  cell_height: number
  padding: number
}

interface SpriteData {
  meta: SpriteMeta
  frames: SpriteFrame[]
}

interface Props {
  initialSpritePng?: string | null
  initialSpriteJson?: string | null
}

export default function PreviewPage({ initialSpritePng, initialSpriteJson }: Props) {
  const [spriteData, setSpriteData] = useState<SpriteData | null>(null)
  const [spriteImageSrc, setSpriteImageSrc] = useState('')
  const [spriteImageLoaded, setSpriteImageLoaded] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(12)
  const [zoom, setZoom] = useState(1)
  const [bgMode, setBgMode] = useState<'checker' | 'black' | 'white' | 'green'>('checker')
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spriteImgRef = useRef<HTMLImageElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const loadedPathRef = useRef<string>('')

  // Load from initial props (from SpritePage auto-navigate)
  useEffect(() => {
    if (initialSpritePng && initialSpriteJson && loadedPathRef.current !== initialSpriteJson) {
      loadedPathRef.current = initialSpriteJson
      loadSpriteFiles(initialSpritePng, initialSpriteJson)
    }
  }, [initialSpritePng, initialSpriteJson])

  const loadSpriteFiles = async (pngPath: string, jsonPath: string) => {
    setError('')
    setSpriteData(null)
    setSpriteImageSrc('')
    setSpriteImageLoaded(false)
    setCurrentFrame(0)
    setPlaying(false)

    try {
      const [dataUrl, jsonData] = await Promise.all([
        window.electronAPI.readAsDataUrl(pngPath),
        window.electronAPI.readJson(jsonPath),
      ])

      const data = jsonData as SpriteData
      if (!data.meta || !data.frames || !data.frames.length) {
        throw new Error('유효하지 않은 스프라이트 시트 JSON입니다.')
      }

      setSpriteData(data)
      setSpriteImageSrc(dataUrl)

      // Pre-load the image element
      const img = new Image()
      img.onload = () => {
        spriteImgRef.current = img
        setSpriteImageLoaded(true)
      }
      img.onerror = () => setError('스프라이트 이미지를 로드할 수 없습니다.')
      img.src = dataUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleOpenFiles = async () => {
    const jsonPath = await window.electronAPI.openFile([
      { name: 'JSON', extensions: ['json'] },
    ])
    if (!jsonPath) return

    // Guess the PNG path from JSON (replace _sprite.json with _sprite.png)
    const pngPath = jsonPath.replace(/\.json$/, '.png')

    // Try auto-detected path first, otherwise ask user
    try {
      await loadSpriteFiles(pngPath, jsonPath)
    } catch {
      // If auto-detect failed, ask user to pick the PNG
      const manualPng = await window.electronAPI.openFile([
        { name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ])
      if (manualPng) {
        await loadSpriteFiles(manualPng, jsonPath)
      }
    }
  }

  // Draw current frame on canvas
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current
    const img = spriteImgRef.current
    if (!canvas || !img || !spriteData) return

    const frame = spriteData.frames[frameIndex]
    if (!frame) return

    const sourceW = frame.sourceSize.w
    const sourceH = frame.sourceSize.h

    canvas.width = sourceW * zoom
    canvas.height = sourceH * zoom

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false

    // Draw the frame region from the sprite sheet
    ctx.drawImage(
      img,
      frame.frame.x,
      frame.frame.y,
      frame.frame.w,
      frame.frame.h,
      frame.spriteSourceSize.x * zoom,
      frame.spriteSourceSize.y * zoom,
      frame.frame.w * zoom,
      frame.frame.h * zoom,
    )
  }, [spriteData, zoom])

  // Redraw when frame changes or zoom changes
  useEffect(() => {
    if (spriteImageLoaded) {
      drawFrame(currentFrame)
    }
  }, [currentFrame, spriteImageLoaded, drawFrame])

  // Animation loop
  useEffect(() => {
    if (!playing || !spriteData) return

    const interval = 1000 / fps
    let lastTime = performance.now()

    const animate = (now: number) => {
      const delta = now - lastTime
      if (delta >= interval) {
        lastTime = now - (delta % interval)
        setCurrentFrame((prev) => (prev + 1) % spriteData.frames.length)
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [playing, fps, spriteData])

  const togglePlay = () => setPlaying((p) => !p)
  const goFirst = () => { setPlaying(false); setCurrentFrame(0) }
  const goPrev = () => {
    setPlaying(false)
    setCurrentFrame((p) => (p - 1 + (spriteData?.frames.length || 1)) % (spriteData?.frames.length || 1))
  }
  const goNext = () => {
    setPlaying(false)
    setCurrentFrame((p) => (p + 1) % (spriteData?.frames.length || 1))
  }
  const goLast = () => {
    setPlaying(false)
    setCurrentFrame((spriteData?.frames.length || 1) - 1)
  }

  const bgStyle: React.CSSProperties = bgMode === 'checker'
    ? { background: 'repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px' }
    : bgMode === 'black'
    ? { background: '#000' }
    : bgMode === 'white'
    ? { background: '#fff' }
    : { background: '#00b894' }

  return (
    <div>
      <div className="page-header">
        <h2>미리보기</h2>
        <p>스프라이트 시트 애니메이션을 미리보기합니다</p>
      </div>

      {/* File loader */}
      {!spriteData && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <ImageIcon size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            스프라이트 시트 JSON 파일을 불러오세요
          </p>
          <button className="btn btn-primary" onClick={handleOpenFiles}>
            <FolderOpen size={16} /> 파일 열기
          </button>
          <p className="form-hint" style={{ marginTop: 12 }}>
            *_sprite.json 파일을 선택하면 PNG 이미지가 자동으로 로드됩니다
          </p>
        </div>
      )}

      {error && (
        <div className="status-bar error" style={{ marginTop: spriteData ? 16 : 16 }}>
          {error}
        </div>
      )}

      {spriteData && spriteImageLoaded && (
        <>
          {/* Controls bar */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Playback controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="btn btn-secondary btn-sm" onClick={goFirst} title="처음 프레임">
                  <SkipBack size={14} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={goPrev} title="이전 프레임">
                  <SkipBack size={12} />
                </button>
                <button className="btn btn-primary btn-sm" onClick={togglePlay} style={{ minWidth: 36 }}>
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={goNext} title="다음 프레임">
                  <SkipForward size={12} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={goLast} title="마지막 프레임">
                  <SkipForward size={14} />
                </button>
              </div>

              {/* Frame counter */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 90, textAlign: 'center' }}>
                {currentFrame + 1} / {spriteData.frames.length}
              </div>

              {/* Frame scrubber */}
              <input
                type="range"
                min={0}
                max={spriteData.frames.length - 1}
                value={currentFrame}
                onChange={(e) => { setPlaying(false); setCurrentFrame(Number(e.target.value)) }}
                style={{ flex: 1, minWidth: 100, accentColor: 'var(--accent)' }}
              />

              {/* FPS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>FPS</label>
                <input
                  className="form-input"
                  type="number"
                  value={fps}
                  onChange={(e) => setFps(Math.min(60, Math.max(1, Number(e.target.value))))}
                  min={1}
                  max={60}
                  style={{ width: 56, padding: '4px 8px', fontSize: 12 }}
                />
              </div>

              {/* Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>배율</label>
                <select
                  className="form-input"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: 64, padding: '4px 8px', fontSize: 12 }}
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x</option>
                </select>
              </div>

              {/* Background */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>배경</label>
                <select
                  className="form-input"
                  value={bgMode}
                  onChange={(e) => setBgMode(e.target.value as typeof bgMode)}
                  style={{ width: 80, padding: '4px 8px', fontSize: 12 }}
                >
                  <option value="checker">체커보드</option>
                  <option value="black">검정</option>
                  <option value="white">흰색</option>
                  <option value="green">초록</option>
                </select>
              </div>

              {/* Load another file */}
              <button className="btn btn-secondary btn-sm" onClick={handleOpenFiles}>
                <FolderOpen size={12} /> 다른 파일
              </button>
            </div>
          </div>

          {/* Canvas viewport */}
          <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 300,
              ...bgStyle,
              padding: 24,
            }}>
              <canvas
                ref={canvasRef}
                style={{
                  imageRendering: 'pixelated',
                  maxWidth: '100%',
                }}
              />
            </div>
          </div>

          {/* Info panel */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>시트 크기</span>
                <div>{spriteData.meta.size.w} x {spriteData.meta.size.h}px</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>프레임 수</span>
                <div>{spriteData.meta.frame_count}개</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>배열</span>
                <div>{spriteData.meta.columns}열 x {spriteData.meta.rows}행</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>셀 크기</span>
                <div>{spriteData.meta.cell_width} x {spriteData.meta.cell_height}px</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>패딩</span>
                <div>{spriteData.meta.padding}px</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>현재 프레임</span>
                <div>{spriteData.frames[currentFrame]?.frame.w} x {spriteData.frames[currentFrame]?.frame.h}px</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
