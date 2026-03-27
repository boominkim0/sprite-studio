import { useState, useEffect, useCallback } from 'react'

export interface Settings {
  xaiApiKey?: string
  defaultOutputDir?: string
  spriteDefaults?: {
    fps?: number
    tolerance?: number
    columns?: number
    padding?: number
  }
  [key: string]: unknown
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.electronAPI.loadSettings().then((data) => {
      setSettings(data as Settings)
      setLoaded(true)
    })
  }, [])

  const save = useCallback(async (next: Settings) => {
    setSettings(next)
    await window.electronAPI.saveSettings(next as Record<string, unknown>)
  }, [])

  const update = useCallback(async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial }
    await save(next)
  }, [settings, save])

  return { settings, loaded, save, update }
}
