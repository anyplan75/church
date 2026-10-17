# 은혜로운 예배 — iPhone·iPad 슬라이드 리모컨

조작만 iPhone·iPad에서 합니다. **하는 일은 현재 예배 슬라이드를 넘기는 것**뿐입니다. 송출은 Mac/Windows 데스크톱 앱이 담당합니다. 같은 Wi‑Fi에서 포트 `18765`로 지금 두 줄만 보냅니다.

주보·사람·라이브러리·전체 설정은 **데스크톱 조작 앱**에서만 씁니다.

## 한 번에 하는 일

1. 송출 컴퓨터에서 **은혜로운 예배 송출**을 켭니다.
2. iPhone·iPad에서 **은혜로운 예배 조작**을 엽니다.
3. 로그인합니다.
4. 처음이거나 연결이 없으면 오른쪽 위 **송출**을 눌러 송출 컴퓨터 IP를 넣고 **저장하고 연결**을 누릅니다. (예: `192.168.0.10`) 이미 저장돼 있으면 자동으로 붙습니다.
5. **현재 예배**를 고르거나(진행 중이면 자동), **이전 / 다음**으로 슬라이드를 넘깁니다.

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
| 로그인, 현재 예배 고르기 | 주보·사람·라이브러리·전체 설정 |
| 큰 이전/다음, 현재·다음 두 줄 미리보기 | 송출 화면(송출은 데스크톱) |
| 송출 IP 한 번 저장·자동 연결 | iPhone에서 로컬 txt 폴더 연결 |

가사·성경 **본문 txt는 조작 컴퓨터**에 둡니다. 모바일은 예배 진행·슬라이드 넘김·송출 연결만 담당합니다.

## 관련 문서

- 데스크톱 설치: [`docs/desktop-install.md`](./desktop-install.md)
- 전체 구조: [`../전체구조안내서.md`](../전체구조안내서.md)
