import { useState } from 'react'
import { Sparkles, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { applyStyleLock, STYLE_LOCK_TEMPLATE, STYLE_LOCK_PLACEHOLDER } from '../constants/styleLock'

interface Props {
  apiKey: string
}

export default function ImagePage({ apiKey }: Props) {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('1k')
  const [count, setCount] = useState(1)
  const [useStyleLock, setUseStyleLock] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<string[]>([])

  const finalPrompt = useStyleLock
    ? applyStyleLock(prompt.trim())
    : prompt.trim()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setResults([])

    try {
      const res = await window.electronAPI.generateImage({
        apiKey,
        prompt: finalPrompt,
        n: count,
        aspectRatio,
        resolution,
      })

      if (res.data && res.data.length > 0) {
        setResults(res.data.map((d) => d.url))
      } else {
        setError('이미지가 반환되지 않았습니다. API 키와 프롬프트를 확인해 주세요.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (url: string, index: number) => {
    const dest = await window.electronAPI.saveFile(
      `generated_image_${index + 1}.png`,
      [{ name: '이미지', extensions: ['png', 'jpg', 'webp'] }]
    )
    if (dest) {
      await window.electronAPI.downloadFile(url, dest)
    }
  }

  // 미리보기용: 유저 프롬프트가 들어갈 위치를 하이라이트
  const previewText = useStyleLock
    ? STYLE_LOCK_TEMPLATE.replace(
        STYLE_LOCK_PLACEHOLDER,
        prompt.trim() || '(프롬프트를 입력하세요)'
      )
    : prompt.trim() || '(프롬프트를 입력하세요)'

  return (
    <div>
      <div className="page-header">
        <h2>이미지 생성</h2>
        <p>xAI Grok Imagine으로 이미지를 생성합니다</p>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">프롬프트</label>
          <textarea
            className="form-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={useStyleLock
              ? "캐릭터를 설명하세요 (Style Lock 템플릿에 삽입됩니다)..."
              : "생성할 이미지를 설명하세요..."
            }
            rows={3}
          />
        </div>

        {/* Style Lock 토글 */}
        <div className="form-group">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: useStyleLock ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
            border: `1px solid ${useStyleLock ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            transition: 'all 0.15s',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
              <input
                type="checkbox"
                checked={useStyleLock}
                onChange={(e) => setUseStyleLock(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Style Lock</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                  플랫 벡터 마스코트 캐릭터 스타일 템플릿
                </div>
              </div>
            </label>
            <button
              className="btn btn-sm"
              style={{ background: 'none', padding: '4px 8px', color: 'var(--text-secondary)' }}
              onClick={() => setShowPreview(!showPreview)}
              title="최종 프롬프트 미리보기"
            >
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span style={{ fontSize: 11, marginLeft: 4 }}>미리보기</span>
            </button>
          </div>

          {showPreview && (
            <div className="progress-log" style={{ marginTop: 8, maxHeight: 240 }}>
              {previewText}
            </div>
          )}
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">종횡비</label>
            <select
              className="form-input"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option value="1:1">1:1 (정사각형)</option>
              <option value="16:9">16:9 (와이드스크린)</option>
              <option value="9:16">9:16 (세로)</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">해상도</label>
            <select
              className="form-input"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="1k">1K</option>
              <option value="2k">2K</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">생성 수</label>
            <input
              className="form-input"
              type="number"
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
              min={1}
              max={10}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-full"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? <><span className="spinner" /> 생성 중...</> : <><Sparkles size={16} /> 이미지 생성</>}
        </button>
      </div>

      {error && (
        <div className="status-bar error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="result-panel">
          <div className="result-grid">
            {results.map((url, i) => (
              <div className="result-item" key={i}>
                <img src={url} alt={`생성된 이미지 ${i + 1}`} />
                <div className="result-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSave(url, i)}>
                    <Download size={14} /> 저장
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
