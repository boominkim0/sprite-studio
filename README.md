# Sprite Studio

AI 이미지/영상 생성부터 스프라이트 시트 변환까지, 게임 개발에 필요한 2D 에셋을 한번에 만들 수 있는 데스크톱 앱입니다.

**xAI Grok API**를 활용하여 이미지와 영상을 생성하고, 영상에서 프레임을 추출하여 배경 제거 후 스프라이트 시트로 조합합니다.

---

## Download

아래 링크에서 OS에 맞는 설치 파일을 다운로드할 수 있습니다.

| OS | 파일 | 링크 |
|---|---|---|
| macOS | `.dmg` | [최신 릴리스 다운로드](https://github.com/boominkim0/sprite-studio/releases/latest) |
| Windows | `.exe` | [최신 릴리스 다운로드](https://github.com/boominkim0/sprite-studio/releases/latest) |

> Releases 페이지에서 원하는 버전을 선택할 수도 있습니다: [All Releases](https://github.com/boominkim0/sprite-studio/releases)

### macOS 사용자 참고

코드 서명이 되어 있지 않아 macOS Gatekeeper가 앱을 차단할 수 있습니다.
"손상되었기 때문에 열 수 없습니다" 메시지가 나타나면 터미널에서 아래 명령어를 실행하세요:

```bash
xattr -rd com.apple.quarantine /path/to/Sprite\ Studio.app
```

또는 DMG 파일에 직접 적용:

```bash
xattr -rd com.apple.quarantine ~/Downloads/Sprite.Studio-1.0.0-arm64.dmg
```

---

## Features

### 1. AI 이미지 생성
- xAI `grok-imagine-image` 모델로 텍스트 프롬프트 기반 이미지 생성
- **Style Lock** 모드: 플랫 벡터 스타일의 일관된 마스코트 캐릭터 생성을 위한 프롬프트 템플릿
- 다양한 비율 (1:1, 16:9, 9:16, 4:3 등) 및 해상도 (1K, 2K) 지원
- 최대 10장 동시 생성

### 2. AI 영상 생성
- 생성된 이미지를 기반으로 `grok-imagine-video` 모델로 영상 생성 (Image-to-Video)
- 1~15초 길이, 다양한 비율/해상도 설정
- 실시간 진행 상태 표시

### 3. 스프라이트 시트 변환
- 영상 파일(mp4, mov, avi, webm, mkv)에서 프레임 추출
- 자동 배경 감지 및 제거 (투명 배경)
- 스프라이트 시트 PNG + JSON 메타데이터 생성
- FPS, 배경색, 허용 오차, 컬럼 수, 패딩 등 세부 설정 가능
- 개별 프레임 PNG 내보내기 옵션

### 4. 애니메이션 미리보기
- Canvas 기반 스프라이트 애니메이션 플레이어
- 재생/일시정지, 프레임 단위 이동, 프레임 스크러버
- FPS 조절 (1~60), 줌 (1x~4x), 배경색 변경
- 스프라이트 메타데이터 정보 패널

---

## Tech Stack

| 영역 | 기술 |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Desktop | Electron |
| Styling | Custom CSS (Dark Theme) |
| Icons | Lucide React |
| Backend | Python (Pillow, NumPy) |
| 영상 처리 | ffmpeg |
| AI API | xAI Grok (grok-imagine-image, grok-imagine-video) |
| 빌드/배포 | electron-builder, GitHub Actions |

---

## Getting Started (개발 환경)

### 사전 요구사항

- **Node.js** 20+
- **Python** 3.9+
- **ffmpeg** (시스템에 설치되어 있어야 함)

### 설치

```bash
# 저장소 클론
git clone https://github.com/boominkim0/sprite-studio.git
cd sprite-studio

# npm 의존성 설치
npm install

# Python 가상환경 생성 및 패키지 설치
cd python
python3 -m venv venv
source venv/bin/activate        # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..
```

### ffmpeg 설치

```bash
# macOS
brew install ffmpeg

# Windows
choco install ffmpeg -y

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 실행

```bash
# 개발 모드 (Electron + Vite HMR)
npm run electron:dev

# Vite 개발 서버만 실행 (브라우저에서 UI 확인)
npm run dev
```

### 빌드

```bash
# 프로덕션 빌드 (현재 OS)
npm run dist

# macOS DMG 빌드
npm run dist:mac

# Windows 설치 파일 빌드
npm run dist:win
```

빌드 결과물은 `release/` 디렉토리에 생성됩니다.

---

## 사용법

1. **Settings** 탭에서 xAI API 키를 입력합니다. ([console.x.ai](https://console.x.ai)에서 발급)
2. **이미지 생성** 탭에서 프롬프트를 입력하고 AI 이미지를 생성합니다.
3. **영상 생성** 탭에서 생성된 이미지를 선택하고 AI 영상을 생성합니다.
4. **스프라이트** 탭에서 영상 파일을 선택하고 스프라이트 시트로 변환합니다.
5. **미리보기** 탭에서 생성된 스프라이트 시트의 애니메이션을 확인합니다.

---

## Release 배포 방법

버전 태그를 push하면 GitHub Actions가 자동으로 macOS(.dmg)와 Windows(.exe)를 빌드하고 GitHub Release에 업로드합니다.

```bash
# 버전 태그 생성 및 push
git tag v1.0.0
git push origin v1.0.0
```

---

## Project Structure

```
sprite-studio/
├── electron/           # Electron 메인/프리로드 프로세스
│   ├── main.ts         #   IPC 핸들러, API 호출, 윈도우 관리
│   └── preload.ts      #   contextBridge API 노출
├── src/                # React 렌더러 (프론트엔드)
│   ├── App.tsx         #   탭 기반 네비게이션
│   ├── pages/          #   페이지 컴포넌트
│   ├── hooks/          #   커스텀 훅 (설정 관리)
│   ├── constants/      #   Style Lock 프롬프트 템플릿
│   └── types/          #   TypeScript 타입 정의
├── python/             # 스프라이트 시트 파이프라인
│   ├── main.py         #   CLI 엔트리포인트
│   └── src/            #   프레임 추출, 배경 제거, 시트 조합
├── build/              # 앱 아이콘 (icns, ico, png)
├── .github/workflows/  # CI/CD (빌드 및 릴리스)
└── package.json
```

---

## License

MIT
