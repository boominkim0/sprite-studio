import { useState, useEffect } from 'react'
import { Layers, FolderOpen, AlertCircle, CheckCircle, FileVideo, Eye } from 'lucide-react'

interface Props {
  onPreview?: (spritePng: string, spriteJson: string) => void
}

export default function SpritePage({ onPreview }: Props) {
  const [videoPath, setVideoPath] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [fps, setFps] = useState<number | ''>('')
  const [bgColor, setBgColor] = useState('')
  const [tolerance, setTolerance] = useState(30)
  const [columns, setColumns] = useState<number | ''>('')
  const [padding, setPadding] = useState(0)
  const [noTrim, setNoTrim] = useState(false)
  const [exportFrames, setExportFrames] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState('')
  const [result, setResult] = useState<{
    spritePng: string | null
    spriteJson: string | null
    outputDir: string
  } | null>(null)

  const [previewSrc, setPreviewSrc] = useState('')

  useEffect(() => {
    const unsub = window.electronAPI.onSpriteProgress((msg) => {
      setLog((prev) => prev + msg)
    })
    return unsub
  }, [])

  const handleSelectVideo = async () => {
    const path = await window.electronAPI.openFile([
      { name: '비디오', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'] },
    ])
    if (path) setVideoPath(path)
  }

  const handleSelectOutput = async () => {
    const dir = await window.electronAPI.openDirectory()
    if (dir) setOutputDir(dir)
  }

  const handleGenerate = async () => {
    if (!videoPath || !outputDir) return
    setLoading(true)
    setError('')
    setLog('')
    setResult(null)
    setPreviewSrc('')

    try {
      const res = await window.electronAPI.generateSprite({
        videoPath,
        outputDir,
        fps: fps ? Number(fps) : undefined,
        bgColor: bgColor || undefined,
        tolerance,
        columns: columns ? Number(columns) : undefined,
        padding,
        noTrim,
        exportFrames,
      })

      setResult(res)

      if (res.spritePng) {
        const dataUrl = await window.electronAPI.readAsDataUrl(res.spritePng)
        setPreviewSrc(dataUrl)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>스프라이트 시트</h2>
        <p>비디오 프레임을 투명 스프라이트 시트와 JSON 메타데이터로 추출합니다</p>
      </div>

      <div className="card">
        <div className="card-title">입력</div>

        <div className="form-group">
          <label className="form-label">비디오 파일</label>
          <div className="file-input">
            <div className="file-path">{videoPath || '파일이 선택되지 않았습니다'}</div>
            <button className="btn btn-secondary btn-sm" onClick={handleSelectVideo}>
              <FileVideo size={14} /> 찾아보기
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">출력 폴더</label>
          <div className="file-input">
            <div className="file-path">{outputDir || '폴더가 선택되지 않았습니다'}</div>
            <button className="btn btn-secondary btn-sm" onClick={handleSelectOutput}>
              <FolderOpen size={14} /> 찾아보기
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">옵션</div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">FPS</label>
            <input
              className="form-input"
              type="number"
              value={fps}
              onChange={(e) => setFps(e.target.value ? Number(e.target.value) : '')}
              placeholder="원본"
              min={1}
              max={60}
            />
            <p className="form-hint">비우면 원본 fps 사용</p>
          </div>
          <div className="form-group">
            <label className="form-label">배경색 (R,G,B)</label>
            <input
              className="form-input"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="자동 감지"
            />
            <p className="form-hint">예: 255,255,255</p>
          </div>
          <div className="form-group">
            <label className="form-label">허용 오차</label>
            <input
              className="form-input"
              type="number"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              min={0}
              max={255}
            />
          </div>
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">열 수</label>
            <input
              className="form-input"
              type="number"
              value={columns}
              onChange={(e) => setColumns(e.target.value ? Number(e.target.value) : '')}
              placeholder="자동"
              min={1}
            />
          </div>
          <div className="form-group">
            <label className="form-label">패딩 (px)</label>
            <input
              className="form-input"
              type="number"
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              min={0}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, paddingBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={noTrim}
                onChange={(e) => setNoTrim(e.target.checked)}
              />
              트리밍 비활성화
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={exportFrames}
                onChange={(e) => setExportFrames(e.target.checked)}
              />
              개별 프레임 이미지 추출
            </label>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-primary btn-full"
          onClick={handleGenerate}
          disabled={loading || !videoPath || !outputDir}
        >
          {loading ? <><span className="spinner" /> 스프라이트 시트 생성 중...</> : <><Layers size={16} /> 스프라이트 시트 생성</>}
        </button>
      </div>

      {log && <div className="progress-log">{log}</div>}

      {error && (
        <div className="status-bar error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {result && (
        <div className="status-bar success">
          <CheckCircle size={16} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            스프라이트 시트가 생성되었습니다!
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.electronAPI.openPath(result.outputDir)}
            >
              폴더 열기
            </button>
            {onPreview && result.spritePng && result.spriteJson && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onPreview(result.spritePng!, result.spriteJson!)}
              >
                <Eye size={12} /> 애니메이션 미리보기
              </button>
            )}
          </div>
        </div>
      )}

      {previewSrc && (
        <div className="result-panel">
          <div className="card">
            <div className="card-title">미리보기</div>
            <div style={{ maxHeight: 400, overflow: 'auto', borderRadius: 'var(--radius)', background: 'repeating-conic-gradient(#222 0% 25%, #2a2a2a 0% 50%) 0 0 / 20px 20px' }}>
              <img src={previewSrc} alt="스프라이트 시트" style={{ width: '100%', display: 'block' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
