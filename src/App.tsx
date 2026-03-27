import { useState, useCallback } from 'react'
import { Image, Video, Layers, Settings, Eye } from 'lucide-react'
import ImagePage from './pages/ImagePage'
import VideoPage from './pages/VideoPage'
import SpritePage from './pages/SpritePage'
import PreviewPage from './pages/PreviewPage'
import SettingsPage from './pages/SettingsPage'
import { useSettings } from './hooks/useSettings'

type Tab = 'image' | 'video' | 'sprite' | 'preview' | 'settings'

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'image', label: '이미지', icon: <Image /> },
  { id: 'video', label: '비디오', icon: <Video /> },
  { id: 'sprite', label: '스프라이트 시트', icon: <Layers /> },
  { id: 'preview', label: '미리보기', icon: <Eye /> },
  { id: 'settings', label: '설정', icon: <Settings /> },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('image')
  const { settings, loaded, update } = useSettings()

  // Preview state: passed from SpritePage or loaded from file
  const [previewPng, setPreviewPng] = useState<string | null>(null)
  const [previewJson, setPreviewJson] = useState<string | null>(null)

  const handlePreviewSprite = useCallback((spritePng: string, spriteJson: string) => {
    setPreviewPng(spritePng)
    setPreviewJson(spriteJson)
    setTab('preview')
  }, [])

  if (!loaded) return null

  const apiKey = (settings.xaiApiKey as string) || ''
  const needsKey = !apiKey && tab !== 'settings' && tab !== 'sprite' && tab !== 'preview'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Sprite Studio</h1>
          <p>xAI Grok Imagine</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          {apiKey ? (
            <div style={{ fontSize: 11, color: 'var(--success)', padding: '8px 12px' }}>
              API 키 설정됨
            </div>
          ) : (
            <button className="nav-item" onClick={() => setTab('settings')} style={{ color: 'var(--warning)' }}>
              <Settings size={16} />
              API 키 설정
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        {needsKey ? (
          <div className="card" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
            <Settings size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
            <h3 style={{ marginBottom: 8 }}>API 키가 필요합니다</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              이미지 및 비디오 생성을 위해 xAI API 키가 필요합니다. 설정에서 입력해 주세요.
            </p>
            <button className="btn btn-primary" onClick={() => setTab('settings')}>
              설정으로 이동
            </button>
          </div>
        ) : (
          <>
            {tab === 'image' && <ImagePage apiKey={apiKey} />}
            {tab === 'video' && <VideoPage apiKey={apiKey} />}
            {tab === 'sprite' && <SpritePage onPreview={handlePreviewSprite} />}
            {tab === 'preview' && <PreviewPage initialSpritePng={previewPng} initialSpriteJson={previewJson} />}
            {tab === 'settings' && <SettingsPage settings={settings} onUpdate={update} />}
          </>
        )}
      </main>
    </div>
  )
}
