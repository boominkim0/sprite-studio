import { useState } from 'react'
import { Eye, EyeOff, Save } from 'lucide-react'
import type { Settings } from '../hooks/useSettings'

interface Props {
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => Promise<void>
}

export default function SettingsPage({ settings, onUpdate }: Props) {
  const [apiKey, setApiKey] = useState(settings.xaiApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const [tolerance, setTolerance] = useState(
    settings.spriteDefaults?.tolerance || 30
  )
  const [fps, setFps] = useState(
    settings.spriteDefaults?.fps || 0
  )

  const handleSave = async () => {
    await onUpdate({
      xaiApiKey: apiKey,
      spriteDefaults: { tolerance, fps: fps || undefined },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h2>설정</h2>
        <p>API 키 및 기본 파라미터를 설정합니다</p>
      </div>

      <div className="settings-section">
        <div className="card">
          <div className="card-title">xAI API 키</div>
          <div className="form-group">
            <label className="form-label">API 토큰</label>
            <div className="token-input-wrap">
              <input
                className="form-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xai-..."
                style={{ paddingRight: 40 }}
              />
              <button className="token-toggle" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="form-hint">
              <span style={{ color: 'var(--accent)' }}>console.x.ai</span>에서 API 키를 발급받으세요
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-title">스프라이트 시트 기본값</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">기본 FPS</label>
              <input
                className="form-input"
                type="number"
                value={fps || ''}
                onChange={(e) => setFps(Number(e.target.value))}
                placeholder="원본 fps"
                min={1}
                max={60}
              />
              <p className="form-hint">0 = 원본 비디오 fps 사용</p>
            </div>
            <div className="form-group">
              <label className="form-label">배경 허용 오차</label>
              <input
                className="form-input"
                type="number"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                min={0}
                max={255}
              />
              <p className="form-hint">0-255, 높을수록 더 많이 제거</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            설정 저장
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--success)' }}>저장됨!</span>
          )}
        </div>
      </div>
    </div>
  )
}
