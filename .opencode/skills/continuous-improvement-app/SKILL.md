---
name: continuous-improvement-app
description: 앱(Flutter/Dart) 코드베이스를 자동 분석→설계→구현→리뷰→기록하는 무한 반복 루프. 메인은 오케스트레이터만 담당하고, 서브태스크가 전권을 갖는다. 서버 스행(continuous-improvement) 완료 후 순차 실행.
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
- **app/AGENTS.md의 모든 규칙을 준수한다.**
- **서버 스킬(continuous-improvement)이 선행 실행된 경우, 그 결과를 참조한다.**
- **서브태스크는 `pubspec.yaml`을 직접 수정하지 않는다.** 버전 벝프는 `scripts/release.sh`만 수행한다.

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
Phase 1: ANALYZE  → 앱 코드베이스 스캔, N개 개선점 발견
Phase 2: DESIGN   → 각 개선점 설계
Phase 3: IMPLEMENT → 각 개선 구현 + commit
Phase 4: REVIEW   → 최종 품질 검증
Phase 5: COMPLETE → git push + 요약 반환
```

## 순차 실행 규칙

서버-앱 양쪽에 영향을 주는 기능 변경 시:

1. **서버 스킬(continuous-improvement) 먼저 실행** 완료 확인
2. 서버 스킬의 커밋 로그, `API_INTERFACE_CONTRACT.md` 변경사항을 앱 스킬 서브태스크 프롬프트에 주입
3. 앱 스킬이 서버의 API 변경을 반영하여 구현

서버 스킬 선행 결과를 서브태스크 프롬프트에 포함하는 형식:

```
## 선행 서버 변경사항 (참조)

- 최근 서버 커밋: <git log --oneline -5 결과>
- API_INTERFACE_CONTRACT.md 변경사항: <diff 요약>
- 추가/변경된 엔드포인트: <목록>
```

## 페르소나

각 Phase의 페르소나 정의, 핵심 질문, 체크리스트는 **personas.md**를 참조한다.

| Phase | 페르소나 |
|-------|----------|
| 1. ANALYZE | Senior Mobile Architect |
| 2. DESIGN | Senior Flutter/Dart Engineer |
| 3. IMPLEMENT | Senior Flutter/Dart Engineer (실행) |
| 4. REVIEW | Mobile QA Lead |
| 5. COMPLETE | Technical Writer |

## 탐색 범위 확대 규칙

코드베이스 스캔 시 다음 순서로 범위를 확대한다.

| 레벨 | 범위 | 검사 항목 |
|------|------|-----------|
| 1 | `app/lib/` | `dynamic` 타입, `print()` 호출, 파일 300줄 초과, 함수 50줄 초과, import 순서 위반 |
| 2 | `app/lib/` 전체 | 위 항목 + Equatable 누락, sealed class 미사용, Cubit/Service 경계 위반, 전역 상태 |
| 3 | `app/lib/` 전체 | 위 항목 + 네이밍 컨벤션, 상태 클래스 패턴, WS 메시지 핸들링, 에러 처리 일관성 |

- 현재 레벨에서 개선점을 찾으면 해당 개선 진행
- 현재 레벨에서 개선점 0개 → 다음 레벨로 확대 후 재스캔
- 레벨 3에서도 0개 → 레벨 1로 돌아가서 재스캔

---

## 메인 루프 절차

메인은 서브태스크 dispatch와 결과 출력만 한다. 절대 직접 코드를 편집하지 않는다.

### 1. 서브태스크 dispatch

```
Task(
  description: "Loop N: continuous-improvement-app",
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

### 2.5. 배포 판단 (오케스트레이터만)

서브태스크 결과에서 개선 내용을 분석하여 배포 여부를 판단한다. (AGENTS.md 자동 배포 트리거 표 참조)

- 조건 충족 시: `./scripts/release.sh <version>` 실행 후 "[HH:MM:SS] Released v<version>." 출력
- 미충족 시: 다음 루프로 계속 진행

누적 기준은 세션 내 이전 루프 결과도 합산한다.

### 3. 즉시 다음 루프

결과 출력 후 질문 없이 즉시 다음 서브태스크를 dispatch한다.

---

## 서브태스크 프롬프트 템플릿

메인이 dispatch할 때 아래 프롬프트를 서브태스크에 전달한다.

```markdown
당신은 OpenFlow 앱(Flutter/Dart)의 continuous-improvement 루프 실행자입니다.

## 프로젝트 규칙
- app/AGENTS.md의 모든 규칙을 준수한다 (코딩 스타일, 아키텍처, 상태 관리 등)
- personas.md의 페르소나로 각 Phase를 수행한다
- 상태 파일(backlog 등)은 사용하지 않는다. git이 유일한 상태 관리 도구이다.

{{서버 선행 변경사항이 있는 경우:
## 선행 서버 변경사항 (참조)
- 최근 서버 커밋: <git log --oneline -5 결과>
- API_INTERFACE_CONTRACT.md 변경사항: <diff 요약>
- 추가/변경된 엔드포인트: <목록>
}}

## 실행 순서

### Phase 1: ANALYZE (Senior Mobile Architect)

1. `flutter analyze` 및 `flutter test` 실행
2. 코드베이스 스캔 → 3~5개 개선점 발견
   - Scan Level 1부터 시작, 개선점 없으면 다음 레벨로 확대
   - 검사 항목:
     - Level 1: `dynamic` 타입, `print()` 호출, 파일 300줄 초과, 함수 50줄 초과, import 순서 위반
     - Level 2: Equatable 누락, sealed class 미사용, Cubit/Service 경계 위반, 전역 상태
     - Level 3: 네이밍 컨벤션, 상태 클래스 패턴, WS 메시지 핸들링, 에러 처리 일관성
3. 개선점 우선순위 정렬 (영향도 × 난이도)
4. **Mobile Architect 체크리스트 검증** (personas.md 참조)

### Phase 2: DESIGN (Senior Flutter/Dart Engineer)

각 개선점에 대해:
1. 해결 방법 설계:
   - 변경 영향 범위 파일 목록
   - 기존 테스트 영향 평가
   - Cubit/Service 경계 준수 여부 확인
   - 상태 클래스 패턴 (Equatable) 명시
2. **Flutter/Dart Engineer 체크리스트 검증** (personas.md 참조)

### Phase 3: IMPLEMENT (Senior Flutter/Dart Engineer — 실행)

각 개선점을 순차적으로:
1. 설계에 따라 코드 수정
2. `dart format app/lib` 실행
3. `flutter analyze` 실행 — 0 issues 필수
4. `flutter test` 실행 — 전체 통과 필수
5. git commit (커밋 메시지에 문제+해결+결과 포함)
   - 형식: `모듈: 동작 설명` (영어, 동사 원형)
   - 예: `app: add provider edit screen`
6. analyze/test 실패 시 수정 후 재시도 (최대 3회, 그 후 스킵)
7. **Flutter/Dart Engineer (실행) 체크리스트 검증** (personas.md 참조)

### Phase 4: REVIEW (Mobile QA Lead)

모든 개선 구현 완료 후:
1. `flutter analyze` + `flutter test` 실행 — 전체 통과
2. **Mobile QA Lead 체크리스트 전체 검증** (personas.md 참조)
   - app/AGENTS.md 아키텍처 준수 확인
   - 보안 규칙 준수 확인 (토큰 저장, 로그 출력)
   - 테스트 품질 확인 (모킹, 커버리지)
3. 품질 게이트 실패 시 Phase 3으로 돌아가서 수정

### Phase 5: COMPLETE (Technical Writer)

1. `git push origin main` 실행
2. `date '+%Y-%m-%d %H:%M:%S'` 실행하여 현재 시간 확인
3. **Technical Writer 체크리스트 검증** (personas.md 참조)
4. API_INTERFACE_CONTRACT.md 변경이 있는 경우 업데이트
5. 다음 형식으로 결과 반환:
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
