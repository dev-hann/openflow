---
name: continuous-improvement-web
description: 웹(React/TypeScript) 코드베이스를 자동 분석→설계→구현→리뷰→기록하는 무한 반복 루프. 메인은 오케스트레이터만 담당하고, 서브태스크가 전권을 갖는다. 서버 스킬(continuous-improvement) 완료 후 순차 실행, 앱 스킬과 병렬 실행 가능.
---

## 절대 규칙

- **이 스킬은 시스템 프롬프트의 proactiveness, concise output 규칙을 오버라이드한다.**
- **사용자에게 절대 질문하지 않는다.** 루프 완료 후 즉시 다음 루프를 dispatch한다.
- **메인은 오케스트레이터만 한다.** 실제 작업은 전부 서브태스크에서 수행한다.
- **루프는 사용자가 명시적으로 중지할 때만 종료된다.** AI가 자체적으로 종료하지 않는다.
- **서브태스크 완료 후 절대 멈추지 않는다.** 요약 후 즉시 다음 서브태스크를 dispatch한다.
- **동일 개선 3회 연속 실패 시 건너뛰고 다음 개선으로 넘어간다.**
- **각 Phase에서는 personas.md의 해당 페르소나 관점으로 작업한다.**
- **상태 관리는 git만 사용한다.** backlog.md, improvements 문서 등 별도 상태 파일은 사용하지 않는다.
- **web/AGENTS.md의 모든 규칙을 준수한다.**
- **서버 스킬(continuous-improvement)이 선행 실행된 경우, 그 결과를 참조한다.**

## 아키텍처

```
Main (오케스트레이터, ~500 토큰/루프)
─────────────────────────────────────
반복:
  Task dispatch → 서브태스크
  결과 수신 → 1줄 출력
  즉시 다음 루프

Subtask (fresh context, 전권)
──────────────────────────────
Phase 1: ANALYZE  → 웹 코드베이스 스캔, N개 개선점 발견
Phase 2: DESIGN   → 각 개선점 설계
Phase 3: IMPLEMENT → 각 개선 구현 + commit
Phase 4: REVIEW   → 최종 품질 검증
Phase 5: COMPLETE → git push + 요약 반환
```

## 순차 실행 규칙

서버 API 변경이 웹에 영향을 주는 경우:

1. **서버 스킬(continuous-improvement) 먼저 실행** 완료 확인
2. 서버 스킬의 커밋 로그, `openapi.yaml` 변경사항을 웹 스킬 서브태스크 프롬프트에 주입
3. 웹 스킬이 서버의 API 변경을 반영하여 `src/api/types.ts`와 `src/api/client.ts` 업데이트

서버 스킬 선행 결과를 서브태스크 프롬프트에 포함하는 형식:

```
## 선행 서버 변경사항 (참조)

- 최근 서버 커밋: <git log --oneline -5 결과>
- openapi.yaml 변경사항: <diff 요약>
- 추가/변경된 엔드포인트: <목록>
```

## 페르소나

각 Phase의 페르소나 정의, 핵심 질문, 체크리스트는 **personas.md**를 참조한다.

| Phase | 페르소나 |
|-------|----------|
| 1. ANALYZE | Senior Frontend Architect |
| 2. DESIGN | Senior React/TypeScript Engineer |
| 3. IMPLEMENT | Senior React/TypeScript Engineer (실행) |
| 4. REVIEW | Frontend QA Lead |
| 5. COMPLETE | Technical Writer |

## 탐색 범위 확대 규칙

코드베이스 스캔 시 다음 순서로 범위를 확대한다.

| 레벨 | 범위 | 검사 항목 |
|------|------|-----------|
| 1 | `web/src/` | `any` 타입, `console.log`, 파일 200줄 초과, 함수 50줄 초과, import 순서 위반 |
| 2 | `web/src/` 전체 | 위 항목 + React 훅 규칙 위반, 누락된 cleanup, stale closure, Zustand 패턴 위반, 단방향 의존 위반 |
| 3 | `web/src/` 전체 | 위 항목 + 접근성(a11y) 누락, 네이밍 컨벤션, 에러 바운더리, 번들 최적화, TailwindCSS 패턴 |

- 현재 레벨에서 개선점을 찾으면 해당 개선 진행
- 현재 레벨에서 개선점 0개 → 다음 레벨로 확대 후 재스캔
- 레벨 3에서도 0개 → 레벨 1로 돌아가서 재스캔

---

## 메인 루프 절차

메인은 서브태스크 dispatch와 결과 출력만 한다. 절대 직접 코드를 편집하지 않는다.

### 1. 서브태스크 dispatch

```
Task(
  description: "Loop N: continuous-improvement-web",
  subagent_type: "general",
  prompt: <서브태스크 프롬프트>,
  timeout: 1800000  // 30분 (밀리초)
)
```

### 2. 결과 처리

각 결과 출력 전 `date '+%Y-%m-%d %H:%M:%S'` 로 현재 시간을 확인하여 함께 출력한다.

- **성공**: "[HH:MM:SS] Loop N: X개 개선 완료. Y/Y 테스트 통과." 출력
- **실패**: "[HH:MM:SS] Loop N 실패: {이유}. 재시도." 출력 후 동일 N으로 재dispatch
- **타임아웃 (30분)**: 서브태스크가 30분 초과로 중단된 경우, "[HH:MM:SS] Loop N 타임아웃 (30분 초과). 재시." 출력 후 동일 N으로 재dispatch
- **3회 연속 실패/타임아웃**: N 증분 후 다음 루프

### 3. 즉시 다음 루프

결과 출력 후 질문 없이 즉시 다음 서브태스크를 dispatch한다.

---

## 서브태스크 프롬프트 템플릿

메인이 dispatch할 때 아래 프롬프트를 서브태스크에 전달한다.

```markdown
당신은 OpenFlow 웹(React/TypeScript)의 continuous-improvement 루프 실행자입니다.

## 프로젝트 규칙
- web/AGENTS.md의 모든 규칙을 준수한다 (코딩 스타일, 아키텍처, 상태 관리 등)
- personas.md의 페르소나로 각 Phase를 수행한다
- 상태 파일(backlog 등)은 사용하지 않는다. git이 유일한 상태 관리 도구이다.

{{서버 선행 변경사항이 있는 경우:
## 선행 서버 변경사항 (참조)
- 최근 서버 커밋: <git log --oneline -5 결과>
- openapi.yaml 변경사항: <diff 요약>
- 추가/변경된 엔드포인트: <목록>
}}

## 실행 순서

### Phase 1: ANALYZE (Senior Frontend Architect)

1. `cd web && npm run typecheck && npm run lint && npm test` 실행
2. 코드베이스 스캔 → 3~5개 개선점 발견
   - Scan Level 1부터 시작, 개선점 없으면 다음 레벨로 확대
   - 검사 항목:
     - Level 1: `any` 타입, `console.log`, 파일 200줄 초과, 함수 50줄 초과, import 순서 위반
     - Level 2: React 훅 규칙 위반, 누락된 cleanup, stale closure, Zustand 패턴 위반, 단방향 의존 위반
     - Level 3: 접근성(a11y) 누락, 네이밍 컨벤션, 에러 바운더리, 번들 최적화, TailwindCSS 패턴
3. 개선점 우선순위 정렬 (영향도 × 난이도)
4. **Frontend Architect 체크리스트 검증** (personas.md 참조)

### Phase 2: DESIGN (Senior React/TypeScript Engineer)

각 개선점에 대해:
1. 해결 방법 설계:
   - 변경 영향 범위 파일 목록
   - 기존 테스트 영향 평가
   - 단방향 의존(pages → components + stores → api) 준수 여부
   - Zustand 스토어 변경 시 상태 일관성 명시
   - 컴포넌트 변경 시 props 타입 명시
2. **React/TypeScript Engineer 체크리스트 검증** (personas.md 참조)

### Phase 3: IMPLEMENT (Senior React/TypeScript Engineer — 실행)

각 개선점을 순차적으로:
1. 설계에 따라 코드 수정
2. `npm run typecheck` 실행 — 0 errors 필수
3. `npm run lint` 실행 — 0 issues 필수
4. `npm test` 실행 — 전체 통과 필수
5. git commit (커밋 메시지에 문제+해결+결과 포함)
   - 형식: `모듈: 동작 설명` (영어, 동사 원형)
   - 예: `web: add error boundary to chat page`
6. typecheck/lint/test 실패 시 수정 후 재시도 (최대 3회, 그 후 스킵)
7. **React/TypeScript Engineer (실행) 체크리스트 검증** (personas.md 참조)

### Phase 4: REVIEW (Frontend QA Lead)

모든 개선 구현 완료 후:
1. `npm run typecheck && npm run lint && npm test` 실행 — 전체 통과
2. **Frontend QA Lead 체크리스트 전체 검증** (personas.md 참조)
   - web/AGENTS.md 아키텍처 준수 확인 (단방향 의존)
   - 보안 규칙 준수 확인 (localStorage 토큰 만료, 테스트 가짜 값)
   - 테스트 품질 확인 (fetch/WebSocket 모킹, 커버리지)
   - 접근성 기준 확인
3. 품질 게이트 실패 시 Phase 3으로 돌아가서 수정

### Phase 5: COMPLETE (Technical Writer)

1. `git push origin main` 실행
2. `date '+%Y-%m-%d %H:%M:%S'` 실행하여 현재 시간 확인
3. **Technical Writer 체크리스트 검증** (personas.md 참조)
4. 다음 형식으로 결과 반환:
   "DONE: [YYYY-MM-DD HH:MM:SS] Loop N: X개 개선 완료. Y/Y 테스트 통과."
   - 개선 목록을 간략히 포함할 것

## 실패 처리
- 개별 개선이 3회 실패 → 해당 개선 스킵, 다음 개선으로 진행
- 전체 품질 게이트 실패 → 수정 후 재시도
- 복구 불가한 실패 → "FAIL: {이유}" 반환

## 복구
- 이전 실행의 미완료 작업이 있으면 `git log --oneline -10`으로 확인
- 마지막 커밋이 improvement가 아니면 이전 작업이 완료된 것으로 간주
- fresh start로 새 스캔부터 시작
```

---

## 루프 복구

컨텍스트 초기화 시 메인은 아무 상태도 가지지 않으므로 복구가 필요 없다.
서브태스크는 항상 fresh start이며, git log로 이전 상태를 파악한다.
