# OpenFlow Companion App

OpenFlow 서버와 연결되는 모바일 컴패니언 앱 (Flutter).

## 기술 스택

- **Flutter 3.29+**, Dart 3.6+, Material 3
- **State:** flutter_bloc (Cubit pattern)
- **WebSocket:** `web_socket_channel` (auto-reconnect, exponential backoff)
- **Secure Storage:** `flutter_secure_storage` (token persistence)
- **Markdown:** `flutter_markdown`

## 주요 기능

- **3-step 온보딩:** 서버 URL 입력 → PIN 페어링 인증 → 프로바이더 설정
- **실시간 채팅:** WebSocket 토큰 스트리밍, 타이핑 인디케이터
- **세션 관리:** 드로어에서 세션 전환/생성/삭제
- **프로바이더 관리:** 12개 프리셋, 추가/수정/삭제, 활성 프로바이더 전환
- **다크/라이트 테마:** Material 3 dynamic theming

## 프로젝트 구조

```
lib/
├── main.dart              # 진입점 + DI
├── app.dart               # MaterialApp, MainScreen
├── config/                # 테마 설정
├── constants/             # 디자인 토큰, 프로바이더 프리셋
├── models/                # 프로토콜 타입 (WS 메시지, 데이터 모델)
├── services/              # API 클라이언트, WebSocket, 인증 저장소
├── cubits/                # 상태 관리 (Auth, Chat, Sessions, Providers, Settings)
├── screens/               # 온보딩, 채팅, 설정, 프로바이더 편집
├── widgets/               # 재사용 위젯
└── utils/                 # URL 정규화, 시간 포맷
```

## 개발

```bash
flutter pub get    # 의존성 설치
flutter run        # 개발 모드 실행
flutter test       # 테스트
flutter build apk  # Android APK 빌드
```

## 서버 연결

OpenFlow 서버(`~/.openflow/`)가 실행 중이어야 합니다. 서버 주소와 포트(기본 9800)를 입력하여 연결합니다.
