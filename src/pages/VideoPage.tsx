import { useState, useEffect } from 'react'
import { Sparkles, Download, AlertCircle, ImagePlus, X } from 'lucide-react'

interface Props {
  apiKey: string
}

export default function VideoPage({ apiKey }: Props) {
  const [prompt, setPrompt] = useState('')
  const [imagePath, setImagePath] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [duration, setDuration] = useState(5)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('480p')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [progress, setProgress] = useState('')

  useEffect(() => {
    const unsub = window.electronAPI.onVideoProgress((data) => {
      setProgress(`폴링 중... ${data.attempt}번째 시도 (상태: ${data.status})`)
    })
    return unsub
  }, [])

  const handleSelectImage = async () => {
    const filePath = await window.electronAPI.openFile([
      { name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    ])
    if (filePath) {
      setImagePath(filePath)
      const dataUrl = await window.electronAPI.readAsDataUrl(filePath)
      setImagePreview(dataUrl)
    }
  }

  const handleRemoveImage = () => {
    setImagePath('')
    setImagePreview('')
  }

  const handleGenerate = async () => {
    if (!imagePath || !imagePreview) return
    setLoading(true)
    setError('')
    setVideoUrl('')
    setProgress('요청 제출 중...')

    try {
      const res = await window.electronAPI.generateVideo({
        apiKey,
        prompt: prompt.trim(),
        duration,
        aspectRatio,
        resolution,
        imageUrl: imagePreview,
      })

      if (res.status === 'done' && res.video) {
        setVideoUrl(res.video.url)
        setProgress('')
      } else if (res.status === 'timeout') {
        setError('비디오 생성 시간이 초과되었습니다. 더 짧은 길이나 간단한 프롬프트를 시도해 주세요.')
      } else {
        setError(`비디오 생성 ${res.status}: ${JSON.stringify(res.error || '')}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleSave = async () => {
    if (!videoUrl) return
    const dest = await window.electronAPI.saveFile(
      'generated_video.mp4',
      [{ name: '비디오', extensions: ['mp4'] }]
    )
    if (dest) {
      await window.electronAPI.downloadFile(videoUrl, dest)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>비디오 생성</h2>
        <p>xAI Grok Imagine Video로 이미지 기반 비디오를 생성합니다</p>
      </div>

      <div className="card">
        {/* 이미지 선택 (필수) */}
        <div className="form-group">
          <label className="form-label">
            원본 이미지 <span style={{ color: 'var(--accent)' }}>*</span>
          </label>
          {imagePreview ? (
            <div style={{
              position: 'relative',
              display: 'inline-block',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <img
                src={imagePreview}
                alt="원본"
                style={{
                  maxWidth: 320,
                  maxHeight: 240,
                  display: 'block',
                  objectFit: 'contain',
                  background: 'var(--bg-secondary)',
                }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  padding: '2px 6px',
                  minWidth: 'auto',
                }}
                title="이미지 제거"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleSelectImage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '24px 32px',
                border: '2px dashed var(--border)',
                borderRadius: 8,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <ImagePlus size={20} />
              이미지 선택
            </button>
          )}
          <p className="form-hint">
            애니메이션할 이미지를 선택하세요. 모델이 이 이미지를 첫 프레임으로 사용합니다.
          </p>
        </div>

        {/* 프롬프트 (선택사항) */}
        <div className="form-group">
          <label className="form-label">프롬프트 (선택사항)</label>
          <textarea
            className="form-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="이미지를 어떻게 애니메이션할지 설명하세요... (비우면 모델이 자동으로 결정합니다)"
            rows={3}
          />
          <p className="form-hint">
            원하는 움직임이나 애니메이션을 설명하세요. 비워두면 모델이 자동으로 애니메이션합니다.
          </p>
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">길이 (초)</label>
            <input
              className="form-input"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.min(15, Math.max(1, Number(e.target.value))))}
              min={1}
              max={15}
            />
            <p className="form-hint">1-15초</p>
          </div>
          <div className="form-group">
            <label className="form-label">종횡비</label>
            <select
              className="form-input"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option value="16:9">16:9 (와이드스크린)</option>
              <option value="9:16">9:16 (세로)</option>
              <option value="1:1">1:1 (정사각형)</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
            </select>
            <p className="form-hint">이미지 비율 재정의</p>
          </div>
          <div className="form-group">
            <label className="form-label">해상도</label>
            <select
              className="form-input"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="480p">480p (빠름)</option>
              <option value="720p">720p (HD)</option>
            </select>
          </div>
        </div>

        <button
          className="btn btn-primary btn-full"
          onClick={handleGenerate}
          disabled={loading || !imagePath}
        >
          {loading ? (
            <><span className="spinner" /> 비디오 생성 중...</>
          ) : (
            <><Sparkles size={16} /> 비디오 생성</>
          )}
        </button>

        {!imagePath && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            생성하려면 원본 이미지를 선택하세요
          </p>
        )}
      </div>

      {loading && progress && (
        <div className="status-bar loading">
          <span className="spinner" />
          {progress}
        </div>
      )}

      {error && (
        <div className="status-bar error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {videoUrl && (
        <div className="result-panel">
          <div className="result-item" style={{ maxWidth: 640 }}>
            <video src={videoUrl} controls autoPlay loop style={{ width: '100%' }} />
            <div className="result-actions">
              <button className="btn btn-secondary btn-sm" onClick={handleSave}>
                <Download size={14} /> 비디오 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
