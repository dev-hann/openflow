# OpenFlow — AI 개발 지침

## 프로젝트 개요

- 초경량 개인 AI 비서 (3초 이내 기동)
- TypeScript (ESM), Node.js 22+
- WebSocket + REST API 채널, OpenAI 호환 LLM
- **전체 스펙 및 기능 명세:** [`SPEC.md`](./SPEC.md) 참조

## 파일 참조 규칙

- 코드 참조 시 항상 프로젝트 루트 상대 경로 사용 (예: `src/llm/client.ts:42`)
- 절대 경로(`~/...`, `/home/...`) 사용 금지

## 프로젝트 구조

```
src/
├── bin.ts                # CLI 진입점
├── index.ts              # 공개 API
├── config/               # 설정 로더 + Zod 스키마
├── cli/                  # CLI 명령어 러너
├── llm/                  # OpenAI 호환 HTTP 클라이언트
├── agent/                # 에이전트 루프 + 프롬프트 빌더
├── memory/               # SQLite 저장소
├── tools/                # 도구 레지스트리 + 실행기
├── channel/              # WebSocket + REST API 서버 (모바일 앱 연동)
├── notification/         # Expo 푸시 알림 서비스
└── utils/                # 로거, 에러 타입
```

- 테스트: 소스 파일 옆에 `*.test.ts` 배치
- 빌드 출력: `dist/`
- 설정: `~/.openflow/openflow.json`

## 아키텍처 경계

### 모듈 간 의존성 방향

```
bin.ts → config → agent → llm
                 → tools
                 → memory
        → channel → agent
        → notification
```

- 상위 모듈이 하위 모듈을 import. 역방향 금지.
- `channel/`은 `agent/`를 호출하지만 `agent/`는 `channel/`을 import하지 않음
- `tools/`는 `llm/`을 import하지 않음
- `memory/`는 다른 모듈을 import하지 않음 (가장 하위)
- `config/`는 다른 모듈을 import하지 않음 (독립적)

### 금지 사항

- `src/` 외부 파일(`dist/`, `node_modules/`)의 import 금지
- 모듈 간 순환 참조 금지
- 전역 상태(globals, 싱글톤) 사용 금지 — 명시적 매개변수 전달
- `any` 타입 사용 금지 — `unknown` 또는 구체적 타입 사용

## 코딩 스타일

### 기본 원칙

- TypeScript (ESM), strict 모드
- 함수형 스타일 선호 (클래스보다 함수와 타입)
- `async/await` 사용, raw Promise 체인 금지
- 에러 처리: `try/catch` + 구체적 에러 타입
- 절대 `@ts-nocheck` 사용 금지
- 주석은 "왜"에만 작성. "무엇"은 코드로 표현
- 파일당 최대 300줄 목표 (700줄 하드 리밋)
- 함수당 최대 50줄 목표

### 네이밍

| 대상 | 컨벤션 | 예시 |
|------|--------|------|
| 파일 | kebab-case | `web-fetch.ts` |
| 함수/변수 | camelCase | `sendMessage()` |
| 타입/인터페이스 | PascalCase | `LlmConfig` |
| 상수 | SCREAMING_SNAKE | `MAX_TOOL_ROUNDS` |
| CLI 명령 | kebab-case | `openflow session-list` |
| 설정 키 | camelCase | `llm.baseUrl` |

### import 순서

```typescript
// 1. Node.js 내장 모듈
import { readFile } from "node:fs/promises";

// 2. 외부 패키지
import { z } from "zod";

// 3. 내부 모듈 (상대 경로 + .js 확장자)
import { loadConfig } from "../config/loader.js";
import { logger } from "../utils/logger.js";
```

- 모든 내부 import는 `.js` 확장자 포함 (ESM 호환)
- 외부 패키지와 내부 모듈 사이에 빈 줄

### 에러 처리

```typescript
// 커스텀 에러 타입 사용
class OpenFlowError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

// 에러 코드는 닫힌 유니온
type ErrorCode =
  | "CONFIG_INVALID"
  | "LLM_REQUEST_FAILED"
  | "LLM_TIMEOUT"
  | "LLM_STREAM_ERROR"
  | "TOOL_EXECUTION_FAILED"
  | "DB_ERROR"
  | "DB_MIGRATION_FAILED"
  | "NOTIFICATION_ERROR"
  | "PERMISSION_DENIED";
```

// Result 타입 패턴 선호 (복구 가능한 경우)
type Result<T, E = OpenFlowError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

- 복구 불가능한 에러: `throw new OpenFlowError(...)`
- 복구 가능한 에러: `Result<T>` 반환
- `catch`에서 에러 타입 체크 후 처리
- 절대 빈 `catch` 블록 금지

### 로깅

```typescript
import { createLogger } from "../utils/logger.js";

const log = createLogger("module-name");

log.info({ sessionId, toolName }, "tool execution started");
log.error({ err, toolName }, "tool execution failed");
log.debug({ requestId, duration }, "LLM request completed");
```

- 구조화된 로깅 (키-값 메타데이터)
- 로거 레벨: `debug` / `info` / `warn` / `error`
- 절대 `console.log` 사용 금지
- 사용자 메시지: `log.info`, 디버그: `log.debug`, 복구가능: `log.warn`, 치명적: `log.error`

### 설정 검증

- 설정 파일, CLI 입력, API 응답에 Zod 검증 필수
- 환경변수 치환: `"${VAR_NAME}"` 패턴만 지원
- 기본값은 스키마에 `.default()`로 정의

## 성능 원칙 (3초 기동)

### 기동 시 금지

- 동적 `import()` 사용 금지 (기동 크리티컬 패스)
- 네트워크 요청 금지 (백그라운드 초기화는 예외)
- 파일 시스템 스캔 금지 (glob, recursive dir scan)
- 외부 프로세스 실행 금지
- 설정 파일 다중 읽기 금지 (1회 읽기 + 캐시)

### 기동 시 필수

- 모든 import는 정적 import
- 설정 1회 읽기 + 캐싱
- SQLite 동기 API로 오픈
- 초기화 `Promise.all()` 병렬 처리

## 빌드 및 개발 명령

```bash
pnpm install          # 의존성 설치
pnpm dev              # 개발 모드 (tsx)
pnpm build            # 빌드
pnpm typecheck        # 타입체크
pnpm lint             # 린트
pnpm format           # 포맷
pnpm test             # 테스트
pnpm test:coverage    # 커버리지
pnpm check            # 전체 검증
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

## 테스트 가이드라인

- 프레임워크: Vitest
- 파일명: `*.test.ts` (소스 파일 옆)
- 커버리지 목표: 80% lines
- 모든 외부 경계(LLM, WebSocket, 파일시스템)는 모킹
- 실제 네트워크 호출 금지
- 임시 디렉토리 사용 후 정리
- 타이머, 환경변수, 모의 모듈 정리 필수

## 커밋 메시지

- 형식: `모듈: 동작 설명` (영어)
- 예시: `llm: add retry with exponential backoff`
- 명령문 스타일 (동사 원형)

## 문서 유지보수

- 코드 변경이 `SPEC.md`의 내용에 영향을 주는 경우 (새 모듈/도구 추가, API 라우트 변경, 설정 스키마 변경, 아키텍처 경계 변경 등), 변경 사항을 반영하여 `SPEC.md`도 함께 업데이트

## 보안

- API 키, 토큰을 로그에 출력 금지
- 실제 시크릿 커밋 금지
- 예시/테스트에는 가짜 값 사용 (`sk-test-...`, `123456:ABC-DEF`)
- 셸 도구는 `workspace` 디렉토리로 제한
- HTTP 도구는 SSRF 방지 적용
