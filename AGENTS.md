# OpenFlow — AI 개발 지침

## 프로젝트 개요

- 초경량 개인 AI 비서 (3초 이내 기동)
- 서버: TypeScript (ESM), Node.js 22+ / 앱: Flutter 3.29+, Dart 3.6+ / 웹: React 19 + Vite
- 통신: WebSocket + REST API, OpenAI 호환 LLM
- **전체 스펙:** [`SPEC.md`](./SPEC.md)
- **서버 지침:** [`server/AGENTS.md`](./server/AGENTS.md)
- **앱 지침:** [`app/AGENTS.md`](./app/AGENTS.md)
- **웹 지침:** [`web/AGENTS.md`](./web/AGENTS.md)

## API-First 워크플로우

**`openapi.yaml`이 API 계약의 SSOT이다. 코드 먼저 수정하고 스펙을 나중에 맞추지 않는다.**

1. `openapi.yaml` 수정
2. 서버: `cd server && npx openapi-typescript ../openapi.yaml -o src/generated/api.ts`
3. 앱: `openapi-generator-cli generate -i openapi.yaml -g dart -o app/lib/models/generated`
4. 생성된 타입/모델 기반으로 구현
5. `generated/` 수동 수정 금지 — 재생성으로 덮어씀

## 커밋 메시지

- 형식: `모듈: 동작 설명` (영어, 명령문)
- 예시: `llm: add retry with exponential backoff`, `app: add provider edit screen`

## 작업 방식

- 기능 단위로 서브태스크 분할하여 병렬 실행
- 서브태스크는 독립된 git worktree (`.worktrees/<branch>`)에서 작업
- 완료 후 메인 워크트리에서 병합 → `git worktree remove`

## 보안

- API 키/토큰 로그 출력 금지, 실제 시크릿 커밋 금지
- 예시/테스트에는 가짜 값 사용 (`sk-test-...`, `123456:ABC-DEF`)
- 셸 도구는 `workspace` 제한, HTTP 도구는 SSRF 방지

## 배포 (Release)

**반드시 `scripts/release.sh`를 통해 배포한다.** 직접 태그 생성 금지.

```bash
./scripts/release.sh 0.5.0
```

스크립트가 자동으로: 버전 검증 → `pubspec.yaml` 수정 (`{버전}+{빌드번호}`) → `flutter pub get` → 커밋 → 태그 → 푸시

### CI/CD

`v*` 태그 푸시 → GitHub Actions → APK 빌드 → GitHub Releases 업로드

### 인앱 업데이트

- `app/lib/services/update_service.dart` — GitHub Releases API 조회, semver 비교, dio APK 다운로드
- `app/lib/cubits/update_cubit.dart` — 상태: idle → checking → available → downloading → readyToInstall → error
- 설정 화면에서 확인 → 다운로드(진행률 바) → 설치 (Package Installer, 실패 시 브라우저 폴백)

## 커밋 전 필수 검증

**pre-commit 훅이 자동 실행된다. (`git commit --no-verify`로 우회 가능하지만 권장하지 않음)**

- 서버 파일 변경 시: `cd server && pnpm typecheck && pnpm lint && pnpm test`
- 앱 파일 변경 시: `cd app && flutter analyze && flutter test`
- 웹 파일 변경 시: `cd web && npm run typecheck && npm run lint && npm test`
- **검증 실패 시 커밋이 거부된다. 먼저 수정 후 재커밋한다.**
