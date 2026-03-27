export interface ElectronAPI {
  loadSettings: () => Promise<Record<string, unknown>>
  saveSettings: (data: Record<string, unknown>) => Promise<boolean>
  openFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  saveFile: (defaultName: string, filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  openDirectory: () => Promise<string | null>
  openPath: (p: string) => Promise<void>
  downloadFile: (url: string, dest: string) => Promise<string>
  readAsDataUrl: (filePath: string) => Promise<string>
  readJson: (filePath: string) => Promise<unknown>
  generateImage: (opts: {
    apiKey: string; prompt: string;
    n?: number; aspectRatio?: string; resolution?: string
  }) => Promise<{ data?: Array<{ url: string }> }>
  generateVideo: (opts: {
    apiKey: string; prompt: string;
    duration?: number; aspectRatio?: string; resolution?: string;
    imageUrl?: string
  }) => Promise<{ status: string; video?: { url: string; duration: number }; error?: unknown }>
  onVideoProgress: (cb: (data: { requestId: string; status: string; attempt: number }) => void) => () => void
  generateSprite: (opts: {
    videoPath: string; outputDir: string;
    fps?: number; bgColor?: string; tolerance?: number;
    columns?: number; padding?: number; noTrim?: boolean;
    exportFrames?: boolean
  }) => Promise<{ success: boolean; spritePng: string | null; spriteJson: string | null; outputDir: string; stdout: string }>
  onSpriteProgress: (cb: (msg: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
