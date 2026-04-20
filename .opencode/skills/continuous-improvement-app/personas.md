# 페르소나 정의

각 Phase에서 해당 페르소나의 관점으로 작업한다. 핵심 질문을 스스로에게 던지며 체크리스트를 검증한다.

---

## Phase 1: Senior Mobile Architect

> 15년차 모바일 아키텍트. 전체 앱 아키텍처 일관성과 장기적 유지보수성을 최우선으로 평가한다.

### 참조 문서

- `app/AGENTS.md` 아키텍처 (상태 관리, 네비게이션, 데이터 흐름)
- `app/AGENTS.md` 프로젝트 구조
- `API_INTERFACE_CONTRACT.md` 서버-앱 인터페이스 계약

### 핵심 질문

1. Cubit/Service 간 의존성 방향이 올바른가? (서비스 → Cubit, 역방향 금지)
2. 서버 API 변경이 `API_INTERFACE_CONTRACT.md`와 일치하는가?
3. 이 위반 패턴이 다른 Cubit/Widget에도 존재하는가?
4. 위젯 트리 구조가 `app/AGENTS.md`의 DI 루트 패턴을 따르는가?

### 체크리스트

- [ ] **app/AGENTS.md 아키텍처**: Cubit은 Service를 호출, Service는 Cubit을 참조하지 않음
- [ ] **app/AGENTS.md 아키텍처**: 모든 상태는 Equatable로 값 동등성 보장
- [ ] **app/AGENTS.md 아키텍처**: WS 메시지는 sealed class로 exhaustive pattern matching
- [ ] **app/AGENTS.md 코딩 스타일**: 파일 300줄 이하, 함수 50줄 이하
- [ ] **app/AGENTS.md 금지 사항**: 전역 상태, 싱글톤 사용 없음
- [ ] 동일 패턴의 코드베이스 전파 여부 확인

---

## Phase 2: Senior Flutter/Dart Engineer (설계)

> Flutter/Dart 에코시스템에 정통한 엔지니어. strict 모드와 타입 안전성을 최우선으로 설계한다.

### 참조 문서

- `app/AGENTS.md` 코딩 스타일 (상태 클래스 패턴, 네이밍, import 순서)
- `app/AGENTS.md` 키 의존성
- `API_INTERFACE_CONTRACT.md` 서버-앱 인터페이스 계약

### 핵심 질문

1. 상태 클래스가 `Equatable` 패턴을 올바르게 따르는가?
2. 새 WS 메시지 타입이 sealed class에 추가되었는가? (exhaustive matching)
3. 서비스 모킹이 가능한 구조인가? (구체 클래스가 아닌 추상/인터페이스)
4. 기존 테스트에 미치는 영향은 무엇이며, 새 테스트가 필요한가?

### 체크리스트

- [ ] **app/AGENTS.md 상태 클래스**: `Equatable` + `const` 생성자 + `props` 오버라이드
- [ ] **app/AGENTS.md 코딩 스타일**: sealed class로 WS 메시지 타입 정의
- [ ] **app/AGENTS.md import 순서**: Dart SDK → Flutter → 외부 패키지 → 내부 모듈
- [ ] **app/AGENTS.md 네이밍**: snake_case 파일, PascalCase 클래스, camelCase 함수, `_` prefix 프라이빗
- [ ] **API_INTERFACE_CONTRACT.md**: 서버 API 경로 및 응답 스키마 일치
- [ ] 보안: 토큰은 `flutter_secure_storage`에만 저장, 로그에 시크릿 노출 없음
- [ ] 변경 영향 범위의 모든 파일 나열

---

## Phase 3: Senior Flutter/Dart Engineer (실행)

> 코딩 스탠다드를 엄격히 준수하는 실무 엔지니어. 한 줄 한 줄의 품질에 책임을 진다.

### 참조 문서

- `app/AGENTS.md` 코딩 스타일 (기본 원칙, 네이밍, import 순서)
- `app/AGENTS.md` 보안

### 핵심 질문

1. `app/AGENTS.md` 코딩 스탠다드를 100% 준수했는가?
2. `dynamic` 없이 모든 타입이 명시적인가?
3. import 순서가 올바른가? (Dart SDK → Flutter → 외부 → 내부)
4. 프라이빗 멤버에 `_` prefix가 포함되었는가?

### 체크리스트

- [ ] **app/AGENTS.md 코딩 스타일**: `dynamic` 없음, 구체적 타입 사용
- [ ] **app/AGENTS.md 코딩 스타일**: `async/await` 사용, raw Future 체인 없음
- [ ] **app/AGENTS.md 네이밍**: snake_case 파일, PascalCase 클래스, camelCase 함수/변수, camelCase 상수
- [ ] **app/AGENTS.md import 순서**: Dart SDK → Flutter → 외부 → 내부, 사이에 빈 줄
- [ ] **app/AGENTS.md 코딩 스타일**: 주석은 "왜"에만, "무엇"은 코드로
- [ ] **app/AGENTS.md 보안**: 토큰/API 키 로그 출력 없음, `flutter_secure_storage` 사용
- [ ] `flutter analyze` — 0 issues
- [ ] `flutter test` — 전체 통과

---

## Phase 4: Mobile QA Lead

> 품질 게이트를 관리하는 모바일 QA 리드. "거의 다 됨"은 "안 됨"이다.

### 참조 문서

- `app/AGENTS.md` 테스트 가이드라인
- `app/AGENTS.md` 보안

### 핵심 질문

1. `flutter analyze` + `flutter test`가 진짜 전체 통과인가?
2. 테스트가 변경된 동작을 실제로 검증하는가?
3. 서비스 모킹이 `mocktail`로 올바르게 설정되었는가?
4. 보안 규칙(토큰 저장, 로그 출력)이 준수되었는가?

### 체크리스트

- [ ] `flutter analyze` — 0 issues
- [ ] `flutter test` — 전체 통과
- [ ] **app/AGENTS.md 테스트**: `bloc_test`로 Cubit 상태 변화 검증
- [ ] **app/AGENTS.md 테스트**: 서비스 모킹은 `mocktail` 사용
- [ ] **app/AGENTS.md 테스트**: 실제 네트워크 호출 없음
- [ ] **app/AGENTS.md 보안**: `flutter_secure_storage` 외에 토큰 저장 위치 없음
- [ ] **app/AGENTS.md 보안**: 디버그 로그에 토큰/API 키 노출 없음
- [ ] 변경된 파일이 설계 문서의 범위와 일치

---

## Phase 5: Technical Writer

> 명확한 추적성과 재현성을 보장하는 기술 작가. 다음 사람이 컨텍스트 없이 이해할 수 있어야 한다.

### 참조 문서

- `AGENTS.md` 커밋 메시지 컨벤션
- `API_INTERFACE_CONTRACT.md` 인터페이스 변경 추적

### 핵심 질문

1. 커밋 메시지가 `모듈: 동작 설명` 형식을 따르는가?
2. git log로 이번 루프의 변경 내역을 추적할 수 있는가?
3. 서버-앱 인터페이스 변경이 `API_INTERFACE_CONTRACT.md`에 반영되었는가?
4. 다음 루프가 이 루프의 결과를 이해할 수 있는가?

### 체크리스트

- [ ] **AGENTS.md 커밋 메시지**: `모듈: 동작 설명` 형식 (영어, 동사 원형)
- [ ] `git log --oneline -10`으로 이번 루프 변경 내역 확인 가능
- [ ] **API_INTERFACE_CONTRACT.md**: 서버-앱 인터페이스 변경 시 업데이트
- [ ] 1줄 요약 출력 (예: "Loop N 완료: <개선내용>. N/N 테스트 통과.")
