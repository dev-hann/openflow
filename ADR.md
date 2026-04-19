# Architecture Decision Records

## ADR-001: OpenAI 호환 API를 유일한 LLM 인터페이스로 채택

### 상태: 수락됨

### 배경
OpenClaw는 프로바이더별 SDK를 개별 통합. provider plugin 아키텍처(plugins/loader.ts 2,519줄 + jiti)가 필요했고 기동 병목 발생.

### 결정
OpenAI Chat Completions API 포맷(`/v1/chat/completions`)만 지원.

### 근거
- 대부분의 LLM 프로바이더가 이미 OpenAI 호환 API 제공
- 프로바이더별 SDK 의존성 제거 → 설치 크기 10배 감소
- jiti JIT 컴파일러 불필요 → 기동 시간 5-20초 절감
- 단순 HTTP 클라이언트 1개로 모든 프로바이더 지원
- `baseUrl` + `apiKey`만으로 구성

### 결과
- LLM 클라이언트 ~150줄 수준
- Anthropic 네이티브 기능 미지원 (trade-off)
- 프로바이더 전환은 `baseUrl` 변경만으로 가능

---

## ADR-002: SQLite를 메모리 백엔드로 채택

### 상태: 수락됨

### 배경
OpenClaw는 LanceDB + QMD + SQLite 조합. 임베딩 계산용 네이티브 애드온 필요.

### 결정
better-sqlite3 단일 데이터베이스. FTS5 대신 단순 `LIKE` 키워드 검색.

### 근거
- 임베딩 모델 의존성 제거 (기동 속도 + 메모리 절약)
- 단일 네이티브 애드온만 필요
- 동기 API로 비동기 오버헤드 없음
- 단일 사용자 기준 LIKE 검색으로 충분

### 결과
- 메모리 모듈 ~200줄
- 의미 검색 불가 (키워드 일치만)
- RAM 사용량 50MB 이하 유지

---

## ADR-003: WebSocket + HTTP 서버를 통신 채널로 채택

### 상태: 수락됨 (revoked & replaced)

### 배경
초기 설계에서는 Telegram Bot API long-polling을 메인 채널로 계획. 이후 모바일 앱(Expo React Native)과의 실시간 통신이 필요해짐.

### 결정
WebSocket + HTTP 서버를 기본 통신 채널로 채택. 클라이언트는 PIN 기반 페어링으로 인증 후 WebSocket으로 실시간 채팅, HTTP REST로 세션/프로바이더 관리.

### 근거
- 모바일 앱과의 실시간 양방향 통신 필요
- 스트리밍 토큰 전송을 위한 WebSocket 필요
- REST API로 세션, 프로바이더, 모델 관리
- PIN 기반 페어링으로 간단한 보안
- Expo 푸시 알림 연동

### 결과
- WebSocket + HTTP 서버가 포함됨 (포트 9800)
- Telegram 의존성(grammy) 제거
- 인증 시스템(auth.ts, auth-store.ts) 추가
- REST API 16개 엔드포인트

---

## ADR-004: 플러그인 시스템 없음

### 상태: 수락됨

### 배경
OpenClaw의 플러그인 시스템은 기동 병목 #2 (2-5초).

### 결정
모든 기능이 코어에 직접 구현.

### 근거
- 단일 채널 + 단일 LLM → 확장 포인트 불필요
- jiti 제거로 2-5초 절감
- 도구 추가는 `src/tools/`에 파일 추가만으로 가능

### 결과
- 새 채널/프로바이더 추가 시 코어 수정 필요
- v2에서 인터페이스 기반 플러그인 도입 가능

---

## ADR-005: Commander.js 대신 직접 argv 파싱

### 상태: 수락됨

### 배경
OpenClaw는 Commander.js로 51개 명령 등록. buildProgram()이 모든 명령 모듈 로딩.

### 결정
CLI 명령 8개를 직접 `process.argv` 파싱으로 처리.

### 근거
- 8개 명령에 Commander.js 의존성은 과함
- 직접 파싱이 50ms 이내 완료
- 의존성 1개 감소

### 결과
- `--help` 출력을 직접 포맷팅
- 서브명령 증가 시 Commander 도입 고려

---

## ADR-006: 설정 파일 1회 읽기 캐싱 (핫 리로드 없음)

### 상태: 수락됨

### 배경
OpenClaw는 설정을 2-4회 읽고 health observation(SHA-256, 백업, 감사) 수행.

### 결정
시작 시 1회 읽기 + Zod 검증 + 메모리 캐싱. 핫 리로드 없음.

### 근거
- 설정 변경은 드묾
- 1회 읽기로 1-3초 절감
- 파일 워처 의존성 불필요
- 설정 일관성 보장

### 결과
- 설정 변경 시 재시작 필요

---

## ADR-007: 정적 도구 레지스트리

### 상태: 수락됨

### 배경
OpenClaw는 jiti로 플러그인에서 도구를 동적 발견.

### 결정
각 도구는 `src/tools/`에 파일 단위 정의. `registry.ts`에서 수동 등록.

### 근거
- 동적 발견 불필요
- 타입 체크가 컴파일 타임에 보장
- 새 도구 추가: 파일 생성 + 레지스트리 1줄 추가
- 도구 비활성화: 설정에서 제어

### 결과
- 도구 활성/비활성은 설정 파일로 제어
- 권한 관리는 레지스트리 레벨에서 처리
