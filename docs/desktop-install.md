# 은혜로운 예배 데스크톱 설치

송출 본선은 앱 직접 연결입니다. 웹 Surge 송출 링크는 쓰지 않습니다. Windows와 Mac 모두 포트 `18765`로 지금 두 줄만 보냅니다.

## Windows에서 설치 파일 만들기

교회 PC(또는 아무 Windows)에서:

```bash
git clone https://github.com/anyplan75/church.git
cd church
cp .env.example .env.local   # Firebase 값 채운 뒤
npm install
npm run desktop:pack:win
```

`desktop-dist/`에 생깁니다.

- `EunhyeWorship-*-portable.exe` — 설치 없이 실행
- `desktop-dist/win-unpacked/은혜로운 예배.exe` — 폴더째 복사해 사용
- 설치형 Setup이 필요하면 Windows에서 `npm run desktop:pack:win:setup`

포터블·언팩 폴더에서는 `desktop/portable-shortcuts.ps1`로 조작/송출/오버레이 바로가기를 만듭니다.

## macOS에서 설치 파일 만들기

Mac에서 Node.js 20 이상으로:

```bash
git clone https://github.com/anyplan75/church.git
cd church
cp .env.example .env.local   # Firebase 값 채운 뒤
npm install
npm run desktop:pack:mac
```

`desktop-dist/`에 생깁니다.

- `EunhyeWorship-*-mac-arm64.dmg` — Apple Silicon
- `EunhyeWorship-*-mac-x64.dmg` — Intel
- 같은 내용의 `.zip`도 함께 만들어집니다

지금 쓰는 Mac 한 대용만 만들려면:

```bash
npm run desktop:pack:mac:current
```

### Mac 설치·실행

1. dmg를 열고 **은혜로운 예배.app**을 Applications로 드래그합니다.
2. dmg(또는 `mac` / `mac-arm64` 폴더) 안의 바로가기를 더블클릭합니다.
   - **은혜로운 예배 조작.command** — 조작 컴퓨터
   - **은혜로운 예배 송출.command** — 송출 메인 전체화면
   - **은혜로운 예배 오버레이.command** — 투명/그라데이션 자막
3. 처음 실행 시 “확인되지 않은 개발자” 안내가 나오면 **시스템 설정 → 개인 정보 보호 및 보안**에서 허용합니다.
4. 로컬 네트워크 접근을 물으면 허용합니다. (포트 `18765`)

터미널에서 실행할 수도 있습니다.

```bash
open -n -a "/Applications/은혜로운 예배.app" --args --mode=operator
open -n -a "/Applications/은혜로운 예배.app" --args --mode=output --display=main
open -n -a "/Applications/은혜로운 예배.app" --args --mode=output --display=overlay
```

## 조작 컴퓨터

1. **은혜로운 예배 조작**을 실행합니다.
2. 로그인 → **설정** → **송출 컴퓨터 찾기** 또는 IP 입력 → **기본값 저장**.
3. 예배 **진행**에서 슬라이드를 넘깁니다. 송출에는 지금 두 줄만 갑니다.

## 송출 컴퓨터

1. **은혜로운 예배 송출**(메인) 또는 **오버레이**를 실행합니다.
2. 메뉴 없이 받을 준비만 합니다.
3. 방화벽·로컬 네트워크 권한을 허용합니다. (포트 `18765`)

껐다 켜도 설정에 저장한 송출 컴퓨터로 다시 붙습니다.
