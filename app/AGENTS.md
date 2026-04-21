# OpenFlow App — 개발 지침

## 프로젝트 개요

- OpenFlow 서버와 연결되는 Flutter 모바일 컴패니언 앱
- Flutter 3.29+, Dart 3.6+, Material 3
- **전체 스펙:** [`SPEC.md`](../SPEC.md)의 Companion App 섹션
- **API 계약 SSOT:** [`openapi.yaml`](../openapi.yaml)

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

## 보안

- 토큰은 `flutter_secure_storage`에만 저장
- 디버그 로그에 토큰/API 키 출력 금지
