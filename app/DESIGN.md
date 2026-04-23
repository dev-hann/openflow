# OpenFlow App — Interaction Design Spec

> 이 문서는 OpenFlow 앱의 인터랙션 패턴을 정의한다.
> UI 코드를 작성/수정할 때 반드시 참조한다. `openapi.yaml`이 API의 SSOT라면,
> 이 문서는 **인터랙션의 SSOT**다.

---

## 원칙

1. **상태 완결성** — 모든 컴포넌트는 loading / empty / populated / error / disabled 5가지 상태를 모두 처리한다. "정상 동작만 구현"은 미완료다.
2. **일관성** — 동일한 역할은 항상 동일한 패턴. 선택은 항상 같은 방식, 삭제는 항상 같은 확인, 에러는 항상 같은 피드백.
3. **즉각 피드백** — 사용자 액션 후 100ms 이내 시각 변화, 3초 이내 결과 표시.
4. **최소 놀람** — 사용자가 예상하는 대로 동작. 닫기 버튼은 1개, 선택은 탭 한 번, 뒤로가기는 제스처.

---

## UI Patterns

### Selection (항목 선택)

항목 수에 따라 패턴을 선택한다.

| 항목 수 | 패턴 | 위젯 | 예시 |
|---------|------|------|------|
| 2–4개 | SegmentedControl | `AnimatedToggleSwitch.rolling` | 프리셋 선택 (`preset_selector.dart`) |
| 5–20개 | BottomSheet 목록 | `showShadSheet` + `ListView` | 모델 선택 (`model_sheet.dart`) |
| 20개 이상 | 검색 가능한 BottomSheet | `showShadSheet` + `ShadInput` + filtered `ListView` | Provider 폼의 모델 선택 |

**Do:**
- 현재 선택값을 명확히 표시 (체크마크, 다른 색상, "사용 중" 라벨)
- 선택 시 즉시 시트 닫기

**Don't:**
- 항목이 많을 때 `Wrap` / `Chip` 사용 (화면이 항목으로 도배됨)
- 선택 UI와 현재 표시 UI가 다른 패턴 사용

### Destructive Actions (삭제, 초기화 등)

- 항상 `ShadDialog` 확인 다이얼로그 표시
- 삭제 대상 이름을 다이얼로그에 표시 (`'${session.title}' 세션을 삭제하시겠습니까?`)
- 취소 버튼이 기본 포커스
- `ShadButton.destructive` 사용

**Do:**
```
ShadDialog(
  title: const Text('삭제'),
  description: Text("'${name}'을(를) 삭제하시겠습니까?"),
  actions: [
    ShadButton.outline(child: const Text('취소'), onPressed: () => pop(false)),
    ShadButton.destructive(child: const Text('삭제'), onPressed: () => pop(true)),
  ],
)
```

**Don't:**
- 삭제를 즉시 실행 (확인 없이)
- "확인" 버튼이 기본 포커스

### Loading (로딩)

대기 시간에 따라 다르게 대응한다.

| 시간 | 패턴 | 사용 |
|------|------|------|
| < 1초 | 로딩 표시 없음 | 버튼 상태 전환, 로컬 상태 변경 |
| 1–3초 | `AppSpinner` | API 호출, 짧은 네트워크 요청 |
| 3–10초 | 프로그레스바 + 설명 텍스트 | 파일 다운로드, 긴 동기화 |
| > 10초 | 백그라운드 작업 + 토스트 알림 | APK 다운로드, 대용량 업로드 |

**Do:**
- 버튼 클릭 → 버튼 내부에 스피너 (버튼 비활성화)
- 리스트 로딩 → 스켈레톤 또는 중앙 스피너
- 완료 후 스피너 즉시 제거

**Don't:**
- 로딩 중 사용자가 다른 액션을 할 수 없게 전체 화면 블록 (필요한 경우만)
- 여러 개의 로딩 인디케이터를 동시에 표시

### Empty States (빈 상태)

빈 상태는 3가지 종류가 있으며, 각각 다른 메시지와 액션을 제공한다.

| 종류 | 메시지 | 액션 |
|------|--------|------|
| **미사용** (한 번도 사용 안 함) | 환영/소개 메시지 | "시작하기" 또는 suggestion 버튼 |
| **결과 없음** (검색/필터 후) | "검색 결과가 없습니다" | 검색어 변경 안내 |
| **에러로 인한 빈 상태** | 구체적 에러 설명 | "다시 시도" 버튼 |

**Do:**
- `ChatEmptyState`의 `EmptyStateVariant` 패턴 사용
- 빈 상태에도 액션(버튼/링크) 제공

**Don't:**
- 빈 화면만 표시 (아무 메시지/액션 없이)

### Error Handling (에러 처리)

에러의 심각도와 컨텍스트에 따라 4가지 레벨을 사용한다.

| 레벨 | 패턴 | 사용 시나리오 |
|------|------|-------------|
| **Page** | 전체 화면 에러 + 재시도 버튼 | 데이터 로딩 실패, 서버 응답 없음 |
| **Section** | 섹션 내 에러 배너 | 설정의 provider 로딩 실패 |
| **Inline** | 필드 아래 에러 텍스트 | 폼 유효성 검사 실패 |
| **Toast** | `ShadToast.destructive` | 백그라운드 작업 실패, 네트워크 일시 오류 |

**Do:**
- 에러 메시지는 사용자가 이해할 수 있는 언어 (`toUserMessage()` 사용)
- 복구 가능하면 "다시 시도" 액션 제공
- 복구 불가능하면 대안 안내

**Don't:**
- 원시 에러 문자열 표시 (`e.toString()` 직접 사용)
- 에러가 발생해도 아무 피드백 없이 무시

### Keyboard & Input (키보드 및 입력)

**핵심 규칙: 채팅 화면의 입력창은 항상 키보드 바로 위에 위치해야 한다.**

- 모든 입력 UI는 `Scaffold` 내부에 배치 (`resizeToAvoidBottomInset: true`)
- `Column`에 `InputBar`를 직접 배치하지 않는다
- 하단 패딩 계산 시 `MediaQuery.viewInsets.bottom` 사용 (`padding.bottom` 아님)
- `SafeArea(top: false)` + `viewInsets.bottom` 조합으로 키보드 위 고정

**Do:**
```dart
Scaffold(
  resizeToAvoidBottomInset: true,
  body: Column(
    children: [
      Expanded(child: MessageList()),
      InputBar(onSend: _sendMessage),
    ],
  ),
)
```

**Don't:**
- `SafeArea`만으로 키보드 대응 (키보드는 viewInsets이지 padding이 아님)
- 입력창이 `Positioned(bottom: 0)`로 고정 (키보드 위로 올라가지 않음)

### Bottom Sheets (바텀시트)

- 닫기 수단은 정확히 **1개**: drag handle 또는 X 버튼 중 하나만
- ShadSheet의 기본 닫기 동작이 있으면 커스텀 X 버튼을 추가하지 않는다
- 내부 스크롤이 시트 닫기 제스처와 충돌하지 않아야 함
- 시스템 뒤로가기 제스처/버튼으로 닫힘

**Do:**
- 짧은 목록: drag handle만 (X 버튼 없음)
- 긴 목록 + 검색: X 버튼 (drag handle과 중복 금지)
- 콘텐츠에 `Flexible` + `shrinkWrap: true` 사용

**Don't:**
- drag handle + X 버튼 동시 사용
- 시트 내부 `ListView`에 `NeverScrollableScrollPhysics` (스크롤 불가)

### Navigation (네비게이션)

- 설정 화면: 오른쪽에서 슬라이드 인 (`SlideTransition`, `Offset(1, 0)` → `Offset.zero`)
- 바텀시트: 아래에서 슬라이드 업 (`ShadSheetSide.bottom`)
- 뒤로가기: AppBar의 `ShadIconButton.ghost` + `LucideIcons.arrowLeft`
- 시스템 스와이프 백 제스처 방해 금지

---

## Screen Behavior Specs

### ChatScreen (`screens/chat_screen.dart`)

```
상태 전이:
  disconnected → connecting → connected
  empty → sending → streaming → complete
                                → failed → (retry/edit)
```

| 상황 | 동작 |
|------|------|
| 초기 (세션 없음) | `EmptyStateVariant.empty` + suggestion 버튼 |
| 초기 (세션 있음) | 메시지 로딩 → 표시 |
| 메시지 전송 | 입력 비활성화 → user bubble + streaming assistant bubble → 완료 |
| 스트리밍 중 | 타이핑 인디케이터 → 토큰 단위 업데이트 → 자동 스크롤 |
| 전송 실패 | 실패한 메시지에 재시도/편집 액션 표시 |
| 세션 전환 | 메시지 clear → 로딩 → 새 메시지 로드 |
| 키보드 활성화 | 입력창이 키보드 상단에 위치, 메시지 영역은 그 위 |
| 서버 연결 끊김 | `EmptyStateVariant.connecting` + 재연결 버튼 |

### SettingsScreen (`screens/settings_screen.dart`)

```
상태 전이:
  loading → populated (provider 목록 표시)
         → empty (provider 없음)
         → error (로딩 실패)
```

| 상황 | 동작 |
|------|------|
| 초기 | provider 목록 로딩 (`AppSpinner`) |
| Provider 전환 | 즉시 스피너 → API 호출 → 목록 갱신 |
| Provider 삭제 | 확인 다이얼로그 → 삭제 → 목록 갱신 |
| 모델 변경 | 카드 탭 → BottomSheet → 선택 → API 호출 → 카드 갱신 |
| 서버 변경 | 확인 다이얼로그 → 모든 데이터 초기화 → 온보딩으로 이동 |

### ProviderEditScreen (`screens/provider_edit_screen.dart`)

```
상태 전이:
  idle → verifying → success (모델 목록) → saved
                     → error (에러 메시지)
```

| 상황 | 동작 |
|------|------|
| 신규 | 프리셋 선택 → 필드 자동완성 → API Key 입력 |
| 편집 | 기존값 표시 → 수정 가능 |
| 연결 확인 | 버튼 클릭 → 스피너 → 성공 배너 + 모델 목록 / 에러 배너 |
| 모델 선택 | 검색 가능한 목록에서 선택 |
| 저장 | 유효성 검사 → API 호출 → 이전 화면 복귀 |

### OnboardingScreen (`screens/onboarding_screen.dart`)

```
상태 전이:
  server → pin → provider → main
```

| 상황 | 동작 |
|------|------|
| 서버 URL 입력 | URL 정규화 → 연결 테스트 |
| PIN 입력 | 6자리 입력 → 자동 검증 |
| Provider 설정 | ProviderEditScreen 재사용 + 건너뛰기 옵션 |

---

## Do / Don't Quick Reference

### Layout

| Do | Don't |
|----|-------|
| `Scaffold` 안에서 `InputBar` 배치 | `Column`에 `InputBar` 직접 배치 |
| `Expanded` / `Flexible`로 오버플로우 방지 | 고정 `height`로 레이아웃 강제 |
| `MediaQuery.viewInsets.bottom`로 키보드 대응 | `MediaQuery.padding.bottom`로 키보드 대응 |
| `SingleChildScrollView`로 폼 감싸기 | 폼이 화면보다 길어질 때 스크롤 불가 |

### Selection

| Do | Don't |
|-----|-------|
| 항목 5개 이상이면 BottomSheet 사용 | `Wrap` + `Chip`으로 100개 항목 표시 |
| 항목 20개 이상이면 검색 기능 추가 | 모든 항목을 한눈에 나열 |
| 현재 선택값 명확히 표시 | 선택 상태를 알 수 없음 |

### Sheets & Dialogs

| Do | Don't |
|-----|-------|
| 닫기 수단 1개만 | drag handle + X 버튼 동시 사용 |
| 삭제 시 확인 다이얼로그 | 확인 없이 즉시 삭제 |
| 시트 내부는 `Flexible` + `shrinkWrap` | `Expanded`로 무한 확장 |

### Feedback

| Do | Don't |
|-----|-------|
| 버튼 액션 → 버튼 내 스피너 | 클릭 후 아무 변화 없음 |
| 에러 → `ShadToast.destructive` | `print()`만 하고 사용자에게 무반응 |
| 빈 목록 → 안내 메시지 + 액션 | 완전히 빈 화면 |
| 로딩 → `AppSpinner` 또는 스켈레톤 | 로딩 중 아무 표시 없음 |

### Consistency

| Do | Don't |
|-----|-------|
| 기존 유사 위젯 참조 후 작성 | 매번 새로운 패턴 발명 |
| `design_tokens.dart` 값만 사용 | 매직 넘버 (hardcoded `16`, `8` 등) |
| `ShadSheet` / `ShadDialog` / `ShadToast` 일관 사용 | `showModalBottomSheet` / `showDialog` 혼용 |
