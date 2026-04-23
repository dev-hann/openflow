# OpenFlow App — 개발 지침

## 프로젝트 개요

- OpenFlow 서버와 연결되는 Flutter 모바일 컴패니언 앱
- Flutter 3.29+, Dart 3.6+, Material 3
- **전체 스펙:** [`SPEC.md`](../SPEC.md)의 Companion App 섹션
- **API 계약 SSOT:** [`openapi.yaml`](../openapi.yaml)
- **인터랙션 디자인 SSOT:** [`DESIGN.md`](./DESIGN.md)

## 아키텍처 규칙

- **flutter_bloc Cubit** 패턴 — 서비스는 `RepositoryProvider`, 상태는 `BlocProvider`
- 모든 상태는 `Equatable`로 값 동등성 보장
- `sealed class`로 WS 메시지 타입 정의 (exhaustive pattern matching)
- DI 트리와 프로젝트 구조는 `app/lib/main.dart`와 디렉토리 직접 확인

## 코딩 스타일

- Dart 3.6+ strict 모드, `async/await` 사용
- 주석은 "왜"에만 작성, 파일당 최대 300줄
- import 순서: Dart SDK → Flutter → 외부 패키지 → 내부 모듈
- 파일: snake_case, 클래스: PascalCase, 함수/변수: camelCase, 프라이빗: `_` prefix
- 의존성, 버전, 빌드 명령은 `app/pubspec.yaml` 참조

## API-First

- API 변경 시 **반드시** `openapi.yaml`을 먼저 수정
- 모델 생성: `openapi-generator-cli generate -i ../openapi.yaml -g dart -o lib/models/generated`
- `lib/models/generated/` 수동 수정 금지
- 엔드포인트, 스키마, 필드 이름은 `openapi.yaml`이 SSOT

## 테스트

- `flutter_test` + `bloc_test` + `mocktail`
- `*_test.dart` 파일은 `test/` 디렉토리
- Cubit은 `blocTest`로 상태 변화 검증, 서비스는 `mocktail`으로 모킹
- 실제 네트워크 호출 금지

## UI Definition of Done

UI 위젯/화면을 작성하거나 수정한 후, 반드시 아래를 모두 충족해야 완료로 간주한다.

### 상태 검증 (State Audit)

- [ ] Loading 상태가 있는가? (`AppSpinner` / 스켈레톤)
- [ ] Empty 상태 메시지가 있는가? (미사용 / 결과없음 / 에러 구분)
- [ ] Error 상태 처리가 있는가? (Toast / 인라인 / 재시도)
- [ ] Disabled 상태가 올바른가? (비활성화 시 시각적 차이)

### 인터랙션 검증 (Interaction Audit)

- [ ] 키보드가 입력창을 가리지 않는가? (Scaffold 내부 배치)
- [ ] 터치 타겟이 최소 44x44인가?
- [ ] 같은 역할의 버튼/액션이 중복되지 않는가?
- [ ] 항목 수에 맞는 선택 패턴을 사용했는가? (`DESIGN.md` Selection 패턴 참조)

### 일관성 검증 (Consistency Audit)

- [ ] 기존 유사 위젯을 참조했는가? (비슷한 기능이 있으면 그 패턴을 따름)
- [ ] `design_tokens.dart`의 값만 사용했는가? (매직 넘버 금지)
- [ ] ShadSheet / ShadDialog / ShadToast 사용이 일관적인가?

### 완료 전 자동 점검

UI 파일 수정 후 아래 명령으로 안티패턴을 검사한다:

```bash
rg "Wrap\(" app/lib/                        # Wrap 사용 시 항목 수 확인
rg "MediaQuery.*padding" app/lib/            # viewInsets 필요한 곳에 padding 사용했는지
rg "showModalBottomSheet" app/lib/           # showShadSheet 대신 사용했는지
rg -n "Scaffold" app/lib/screens/            # Scaffold 없는 화면 있는지
```

## UI 작업 프롬프트 템플릿

UI 작업을 요청/수행할 때는 아래 항목을 반드시 고려한다:

1. **목적**: 이 UI가 해결하는 사용자 문제
2. **상태**: 가능한 모든 상태 나열 (loading / empty / populated / error / disabled)
3. **인터랙션**: 사용자가 할 수 있는 모든 액션과 예상 피드백
4. **레퍼런스**: 비슷한 패턴의 기존 코드 경로
5. **엣지 케이스**: 항목 0개, 항목 100개, 네트워크 끊김, 소형 화면 (iPhone SE)

## 보안

- 토큰은 `flutter_secure_storage`에만 저장
- 디버그 로그에 토큰/API 키 출력 금지
