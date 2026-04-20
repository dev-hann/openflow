# OpenFlow — AI 개발 지침

## 프로젝트 개요

- 초경량 개인 AI 비서 (3초 이내 기동)
- 서버: TypeScript (ESM), Node.js 22+
- 앱: Flutter 3.29+, Dart 3.6+
- 통신: WebSocket + REST API, OpenAI 호환 LLM
- **전체 스펙 및 기능 명세:** [`SPEC.md`](./SPEC.md) 참조

## 구성요소별 개발 지침

- **서버 (`src/`):** [`AGENTS.server.md`](./AGENTS.server.md)
- **모바일 앱 (`app/`):** [`app/AGENTS.md`](./app/AGENTS.md)

## 파일 참조 규칙

- 코드 참조 시 항상 프로젝트 루트 상대 경로 사용 (예: `src/llm/client.ts:42`, `app/lib/services/websocket_service.dart:42`)
- 절대 경로(`~/...`, `/home/...`) 사용 금지

## 프로젝트 구조

```
openflow/
├── src/                    # 서버 (TypeScript / Node.js)
│   ├── bin.ts              # CLI 진입점
│   ├── index.ts            # 공개 API
│   ├── config/             # 설정 로더 + Zod 스키마
│   ├── cli/                # CLI 명령어 러너
│   ├── llm/                # OpenAI 호환 HTTP 클라이언트
│   ├── agent/              # 에이전트 루프 + 프롬프트 빌더
│   ├── memory/             # SQLite 저장소
│   ├── tools/              # 도구 레지스트리 + 실행기
│   ├── channel/            # WebSocket + REST API 서버 (모바일 앱 연동)
│   ├── notification/       # Expo 푸시 알림 서비스
│   └── utils/              # 로거, 에러 타입
│
├── app/                    # 모바일 앱 (Flutter / Dart)
│   └── lib/
│       ├── main.dart       # 진입점 + DI
│       ├── app.dart        # MaterialApp, MainScreen
│       ├── config/         # 테마 설정
│       ├── constants/      # 디자인 토큰, 프로바이더 프리셋
│       ├── models/         # 프로토콜 타입 (WS 메시지, 데이터 모델)
│       ├── services/       # API 클라이언트, WebSocket, 인증 저장소
│       ├── cubits/         # 상태 관리 (Auth, Chat, Sessions, Providers, Settings)
│       ├── screens/        # 온보딩, 채팅, 설정, 프로바이더 편집
│       ├── widgets/        # 재사용 위젯
│       └── utils/          # URL 정규화, 시간 포맷
│
├── SPEC.md                 # 전체 스펙 및 기능 명세
├── ADR.md                  # 아키텍처 결정 기록
├── API_INTERFACE_CONTRACT.md  # 모듈간 인터페이스 계약서
├── AGENTS.server.md        # 서버 개발 지침
└── app/AGENTS.md           # 앱 개발 지침
```

## 작업 방식

### 병렬 서브태스크

- 모든 작업을 기능 단위로 분할하여 서브태스크로 병렬 실행
- 각 서브태스크는 독립된 git worktree에서 작업하여 충돌 방지
- 서브태스크 간 파일 충돌이 발생하지 않도록 작업 단위 설계

### Git 워크트리

- 서브태스크 실행 시 `git worktree add`로 격리된 작업 공간 생성
- 워크트리 경로: `.worktrees/<branch-name>` 규칙 사용
- 작업 완료 후 메인 워크트리에서 병합
- 병합 완료 후 `git worktree remove`로 정리
- `.worktrees/`는 `.gitignore`에 추가

## 커밋 메시지

- 형식: `모듈: 동작 설명` (영어)
- 예시: `llm: add retry with exponential backoff`, `app: add provider edit screen`
- 명령문 스타일 (동사 원형)

## 문서 유지보수

- 코드 변경이 `SPEC.md`의 내용에 영향을 주는 경우 (새 모듈/도구 추가, API 라우트 변경, 설정 스키마 변경, 아키텍처 경계 변경 등), 변경 사항을 반영하여 `SPEC.md`도 함께 업데이트

## 보안

- API 키, 토큰을 로그에 출력 금지
- 실제 시크릿 커밋 금지
- 예시/테스트에는 가짜 값 사용 (`sk-test-...`, `123456:ABC-DEF`)
- 셸 도구는 `workspace` 디렉토리로 제한
- HTTP 도구는 SSRF 방지 적용
