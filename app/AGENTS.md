# OpenFlow App — 개발 지침

## 프로젝트 개요

- OpenFlow 서버와 연결되는 Flutter 모바일 컴패니언 앱
- Flutter 3.29+, Dart 3.6+, Material 3
- 서버와의 통신: WebSocket (실시간 채팅) + REST API (세션/프로바이더 관리)
- **서버 개발 지침:** [`server/AGENTS.md`](../server/AGENTS.md)
- **전체 스펙:** [`SPEC.md`](../SPEC.md)의 Companion App 섹션
- **API 계약 SSOT:** [`openapi.yaml`](../openapi.yaml)

## API-First 워크플로우

**[`openapi.yaml`](../openapi.yaml)이 API 계약의 단일 진실 공급원이다.**

### 모델 생성

```bash
openapi-generator-cli generate -i ../openapi.yaml -g dart -o lib/models/generated
```

### 규칙

- API 변경 시 **반드시** `openapi.yaml`을 먼저 수정하고 모델을 재생성
- `fromJson`/`toJson` 필드 이름은 `openapi.yaml` 스키마와 일치해야 함 (camelCase)
- API 응답 모델의 `fromJson`을 **절대 수동으로 작성하지 않음** — 생성된 모델 사용
- `lib/models/generated/` 디렉토리의 파일은 수동 수정 금지 — 재생성으로 덮어씀
- 새 엔드포인트 추가, 필드 변경 시 `openapi.yaml` → 모델 생성 → 구현 순서

## 파일 참조 규칙

- 코드 참조 시 프로젝트 루트 상대 경로 사용 (예: `app/lib/services/websocket_service.dart:42`)
- 절대 경로(`~/...`, `/home/...`) 사용 금지

## 프로젝트 구조

```
app/lib/
├── main.dart                   # 진입점 + DI (MultiBlocProvider, RepositoryProvider)
├── app.dart                    # MaterialApp, MainScreen, Auth 게이팅
├── config/
│   └── theme.dart              # Material 3 라이트/다크 테마
├── constants/
│   ├── dimensions.dart         # 디자인 토큰 (Spacing, AppRadius, AppShadows)
│   └── presets.dart            # LLM 프로바이더 프리셋 (12개)
├── models/
│   ├── generated/              # openapi-generator 생성 모델 (수동 수정 금지)
│   └── protocol.dart           # WS 메시지 타입 (sealed class, OpenAPI 범위 밖)
├── services/
│   ├── api_client.dart         # REST API 클라이언트
│   ├── auth_storage.dart       # flutter_secure_storage 기반 토큰 영속화
│   └── websocket_service.dart  # WebSocket + 자동 재연결 + 인증 핸드셰이크
├── cubits/
│   ├── auth_cubit.dart         # 인증 상태 + 토큰 갱신 (Completer 중복 제거)
│   ├── chat_cubit.dart         # 채팅 메시지 + 스트리밍 상태
│   ├── sessions_cubit.dart     # 세션 목록 + 활성 세션
│   ├── providers_cubit.dart    # 프로바이더 목록 + 전환 상태
│   └── settings_cubit.dart     # 서버 URL, 모델 설정
├── screens/
│   ├── onboarding_screen.dart  # 3-step 온보딩 (서버 → PIN → 프로바이더)
│   ├── chat_screen.dart        # 메인 채팅 UI + WS 라이프사이클
│   ├── settings_screen.dart    # 설정 (연결, 프로바이더, 모델)
│   └── provider_edit_screen.dart # 프로바이더 추가/편집
├── widgets/
│   ├── app_drawer.dart         # 네비게이션 드로어 (세션 목록)
│   ├── chat_empty_state.dart   # 빈 상태 / 연결중 / 끊김 표시
│   ├── connection_section.dart # 연결 상태 카드
│   ├── error_boundary.dart     # 에러 바운더리
│   ├── input_bar.dart          # 메시지 입력 바
│   ├── message_bubble.dart     # 채팅 버블 (마크다운 + 타이핑)
│   ├── message_list.dart       # 스크롤 메시지 목록
│   ├── model_section.dart      # 모델 선택 바텀시트
│   ├── provider_form.dart      # 프로바이더 폼
│   ├── provider_sheet.dart     # 프로바이더 목록 바텀시트
│   ├── typing_indicator.dart   # 3점 타이핑 애니메이션
│   └── verify_section.dart     # 프로바이더 연결 확인 UI
└── utils/
    ├── normalize_url.dart      # URL 정규화
    └── format_time.dart        # 시간 포맷 (HH:MM, 상대시간)
```

## 아키텍처

### 상태 관리

- **flutter_bloc Cubit 패턴** (5개 Cubit)
- 서비스는 `RepositoryProvider`로, 상태는 `BlocProvider`로 주입
- 모든 상태는 `Equatable`로 값 동등성 보장

```
main.dart (DI 루트)
  ├── RepositoryProvider<AuthStorage>
  ├── RepositoryProvider<WebSocketService>
  ├── BlocProvider<AuthCubit>
  ├── BlocProvider<ChatCubit>
  ├── BlocProvider<SessionsCubit>
  ├── BlocProvider<ProvidersCubit>
  └── BlocProvider<SettingsCubit>
```

### 네비게이션

- 명령형 `MaterialPageRoute` 사용
- `OnboardingScreen` → `MainScreen` (인증 게이팅)
- `SettingsScreen` → `ProviderEditScreen` (push)

### 데이터 흐름

```
사용자 입력
  → ChatCubit.addMessage()
    → WebSocketService.send(WsChatMsg)
      → 서버 처리 (Agent Engine)
        → WsTokenChunk (스트리밍)
          → ChatCubit.appendToLastMessage()
        → WsResponse (최종 응답)
          → ChatCubit.finalizeLastMessage()
```

## 코딩 스타일

### 기본 원칙

- Dart 3.6+ strict 모드
- `sealed class`로 WS 메시지 타입 정의 (exhaustive pattern matching)
- `Equatable` 모든 상태/모델에 적용
- `async/await` 사용
- 주석은 "왜"에만 작성
- 파일당 최대 300줄 목표

### 네이밍

| 대상 | 컨벤션 | 예시 |
|------|--------|------|
| 파일 | snake_case | `websocket_service.dart` |
| 클래스 | PascalCase | `AuthCubit` |
| 함수/변수 | camelCase | `sendMessage()` |
| 상수 | camelCase | `maxRetries` |
| 프라이빗 멤버 | `_` prefix | `_handleMessage()` |

### import 순서

```dart
// 1. Dart SDK
import 'dart:async';

// 2. Flutter
import 'package:flutter/material.dart';

// 3. 외부 패키지
import 'package:flutter_bloc/flutter_bloc.dart';

// 4. 내부 모듈
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
```

### 상태 클래스 패턴

```dart
class FooState extends Equatable {
  final String value;
  final bool isLoading;

  const FooState({this.value = '', this.isLoading = false});

  @override
  List<Object?> get props => [value, isLoading];
}
```

## 빌드 및 개발 명령

```bash
flutter pub get        # 의존성 설치
flutter run            # 개발 모드
flutter analyze        # 정적 분석 (very_good_analysis)
flutter test           # 테스트 실행
flutter build apk      # Android APK 빌드 (split-per-abi)
```

- `flutter analyze` — 0 issues 필수 (린트는 `very_good_analysis` 적용)
- `flutter test` — 전체 통과 필수

## 테스트 가이드라인

- 프레임워크: `flutter_test` + `bloc_test` + `mocktail`
- 파일명: `*_test.dart` (`test/` 디렉토리)
- Cubit 테스트: `blocTest`로 상태 변화 검증
- 서비스 모킹: `mocktail`으로 `ApiClient`, `WebSocketService` 모킹
- 실제 네트워크 호출 금지

## 키 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `flutter_bloc` | ^9.1.0 | 상태 관리 (Cubit) |
| `web_socket_channel` | ^3.0.2 | WebSocket 클라이언트 |
| `http` | ^1.3.0 | REST API 클라이언트 |
| `flutter_secure_storage` | ^9.2.4 | 토큰 안전 저장 |
| `flutter_markdown` | ^0.7.7 | 마크다운 렌더링 |
| `equatable` | ^2.0.7 | 값 동등성 |

## 서버 API 연동

서버와 통신하는 모든 엔드포인트는 `openapi.yaml`에 정의되며, 필드 이름과 응답 스키마의 SSOT이다.

| 카테고리 | 엔드포인트 | openapi.yaml 참조 |
|----------|-----------|-------------------|
| 인증 | `POST /api/auth/pair/init`, `POST /api/auth/pair/verify`, `POST /api/auth/refresh`, `DELETE /api/auth/unpair` | `PairInitResponse`, `TokenPairResponse` 등 |
| 세션 | `GET /api/sessions`, `POST /api/sessions`, `DELETE /api/sessions/{sessionId}` | `SessionListResponse`, `CreateSessionResponse` 등 |
| 프로바이더 | `GET /api/providers`, `POST /api/providers`, `PUT /api/providers/{providerId}`, `DELETE /api/providers/{providerId}`, `PUT /api/providers/current`, `POST /api/providers/{providerId}/verify`, `GET /api/providers/{providerId}/models` | `ProviderResponse`, `SwitchProviderResponse` 등 |
| 상태 | `GET /api/status` | `StatusResponse` |

> **참고:** 실제 필드 이름, 요청/응답 구조, 필수 여부는 모두 `openapi.yaml`의 schemas 섹션에 정의됨. 생성된 Dart 모델을 통해 자동 동기화.

## 보안

- 토큰은 `flutter_secure_storage`에만 저장
- 디버그 로그에 토큰/API 키 출력 금지
- HTTP 통신 시 로컬 서버 접속을 위해 `usesCleartextTraffic=true` 설정 (Android)
