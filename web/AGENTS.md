# OpenFlow Web — 개발 지침

## 프로젝트 개요

- React SPA 채팅 인터페이스 (서버 관리는 Flutter 앱 담당)
- Vite + React 19 + TypeScript + TailwindCSS + Zustand
- **전체 스펙:** [`SPEC.md`](../SPEC.md)
- **API 계약 SSOT:** [`openapi.yaml`](../openapi.yaml)

## 아키텍처

- pages/ → components/ + stores/ → api/ 단방향 의존
- Store: Zustand (클래스 금지, 함수만)
- 스타일: TailwindCSS 유틸리티만
- Paths: `@/` → `src/`

## 코딩 스타일

- TypeScript strict, 함수형 컴포넌트 + 훅
- 주석은 "왜"에만, 파일당 200줄, 함수당 50줄
- 파일: PascalCase (`ChatPage.tsx`), 함수: camelCase, 타입: PascalCase
- import: 외부 패키지 → `@/` 내부 모듈

## 빌드 명령

```bash
npm run dev        # :5173 (프록시 → :9800)
npm run build      # → dist/
npm run typecheck  # tsc
npm run lint       # ESLint
npm test           # Vitest
```

## API-First

- API 변경 시 **반드시** `openapi.yaml`을 먼저 수정
- `src/api/types.ts`는 `openapi.yaml` 기반으로 수동 유지
- 엔드포인트, 스키마, 필드 이름은 `openapi.yaml`이 SSOT

## 테스트

- Vitest + React Testing Library + jsdom
- `*.test.ts(x)` 소스 파일 옆 배치
- `fetch`, `WebSocket` 모킹, 실제 네트워크 금지
- Zustand store는 `beforeEach`에서 초기화
- 커버리지: stores/api 80%+, components 70%+

## 보안

- localStorage 토큰 자동 만료 확인
- 테스트에 가짜 값 사용 (`at_test-...`)
