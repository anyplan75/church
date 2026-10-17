# 은혜로운 예배 — iPhone·iPad 조작 앱

조작만 iPhone·iPad에서 합니다. **송출은 계속 Mac/Windows 데스크톱 앱**입니다. 같은 Wi‑Fi에서 포트 `18765`로 지금 두 줄만 보냅니다.

## 한 번에 하는 일

1. 송출 컴퓨터에서 **은혜로운 예배 송출**을 켭니다.
2. iPhone·iPad에서 **은혜로운 예배 조작**을 엽니다.
3. 로그인합니다.
4. **설정**에서 송출 컴퓨터 IP를 넣고 **기본값 저장**을 누릅니다. (예: `192.168.0.10`)
5. **예배 → 진행**에서 **이전 / 다음**으로 슬라이드를 넘깁니다.

로컬 네트워크 권한을 물으면 **허용**합니다.

## Mac에서 빌드·시뮬레이터

Node.js 20+, Xcode, CocoaPods가 있는 Mac에서:

```bash
git clone https://github.com/anyplan75/church.git
cd church
cp .env.example .env.local   # Firebase 값 채운 뒤
npm install
npm run mobile:sync
npx cap open ios
```

Xcode에서 시뮬레이터(또는 내 iPhone)를 고르고 Run합니다.

터미널에서 시뮬레이터만 바로 띄우려면:

```bash
npm run mobile:ios:sim
```

실기기에 넣을 때는 Xcode에서 Signing Team을 본인 Apple ID로 맞춘 뒤 Run합니다. App Store 배포는 이 문서 범위를 넘습니다.

## 웹만 다시 넣고 싶을 때

화면 코드를 고친 뒤:

```bash
npm run mobile:sync
```

`out/`을 iOS 프로젝트에 다시 복사합니다.

## 되는 것 / 안 되는 것

| 되는 것 | 안 되는 것 |
| --- | --- |
| 로그인, 주보·이번 주·예배 목록 | 송출 화면(송출은 데스크톱) |
| 예배 진행, 슬라이드 이전/다음 | iPhone에서 로컬 txt 폴더 연결 |
| 설정에서 송출 IP 저장·LAN 연결 | 자동으로 송출 PC 찾기(데스크톱 조작만) |

가사·성경 **본문 txt는 조작 컴퓨터**에 둡니다. 모바일은 클라우드 메타(예배 순서·진행)와 송출 연결만 담당합니다. 본문이 필요한 슬라이드는 조작 PC 라이브러리를 먼저 연결해 두거나, 순서 제목만으로 넘깁니다.

## 관련 문서

- 데스크톱 설치: [`docs/desktop-install.md`](./desktop-install.md)
- 전체 구조: [`../전체구조안내서.md`](../전체구조안내서.md)
