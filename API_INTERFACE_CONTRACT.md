# OpenFlow — 모듈간 인터페이스 계약서

## 1. Config 모듈 (`src/config/`)

### `loadConfig(): OpenFlowConfig`

```typescript
export function loadConfig(): OpenFlowConfig;
```

- 설정 파일을 1회 읽고 캐시된 값을 반환
- 최초 호출 시 파일 읽기 + Zod 검증
- 이후 호출은 캐시 반환
- throws: `OpenFlowError("CONFIG_INVALID")`

### `getConfigPath(): string`

```typescript
export function getConfigPath(): string;
```

- 우선순위: `OPENFLOW_CONFIG` env > `~/.openflow/openflow.json`

### `OpenFlowConfig` 타입

```typescript
interface OpenFlowConfig {
  llm: {
    maxTokens: number;
    temperature: number;
  };
  notification: {
    enabled: boolean;
    onStart: string;
    onStop: string;
  };
  agent: {
    systemPrompt: string;
    maxToolRounds: number;
    workspace: string;
    dailyMemoryDays: number;
  };
  memory: {
    contextSize: number;
    dbPath: string;
  };
  tools: {
    shell: { enabled: boolean; timeout: number };
    webFetch: { enabled: boolean };
    webSearch: { enabled: boolean };
    httpRequest: { enabled: boolean };
    browser: { enabled: boolean; timeout: number; headless: boolean };
    requireConfirmation: string[];
    confirmationTimeout: number;
  };
  skills: {
    enabled: boolean;
    extraDirs: string[];
    entries: Record<string, { enabled: boolean }>;
  };
  websocket: {
    enabled: boolean;
    host: string;
    port: number;
    cors: boolean;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
  };
}
```

---

## 2. LLM 모듈 (`src/llm/`)

### `createLlmClient(config: LlmConfig): LlmClient`

```typescript
interface LlmClient {
  chat(params: ChatParams): Promise<LlmResponse>;
  complete(params: CompleteParams): Promise<string>;
}
```

- `chat()`: 스트리밍 채팅 완성 (tool_use 포함)
- `complete()`: 단순 완성 (스트리밍 없음)
- 재시도: 5xx 에러 지수 백오프 (최대 3회)
- 타임아웃: 30초
- `signal` abort 시 즉시 에러 throw
- 응답 파싱에 런타임 검증 적용

```typescript
interface ChatParams {
  messages: ChatMessage[];
  toolDefinitions?: ToolDefinition[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

type LlmResponse =
  | { type: "text"; content: string }
  | { type: "tool_calls"; toolCalls: ToolCall[] };
```

### `createProviderPool(providerStore, options?): ProviderPool`

```typescript
interface ProviderPool {
  getClient(): LlmClient;
  getActiveProvider(): Provider | null;
  getActiveProviderId(): string;
  switchProvider(id: string): void;
  syncFromStore(): void;
  listProviders(): { id: string; name: string; model: string; isActive: boolean }[];
}
```

- 다중 LLM 프로바이더 관리
- 활성 프로바이더 전환 지원
- ProviderStore와 자동 동기화

---

## 3. Agent 모듈 (`src/agent/`)

### `createAgentEngine(deps: AgentDeps): AgentEngine`

```typescript
interface AgentEngine {
  handleMessage(params: HandleMessageParams): Promise<AgentResponse>;
  getWorkspace(): WorkspaceLoader;
  updateChannelSender(sender: ChannelSender): void;
}
```

에이전트 루프 계약:
1. 메시지를 메모리에 저장
2. 컨텍스트 빌드 (시스템 프롬프트 + 대화 기록 + 도구 정의)
3. LLM 호출
4. `tool_calls` 응답 → 도구 실행 → 결과 추가 → 3번 반복
5. 텍스트 응답 → 반환
6. `maxToolRounds` 초과 시 에러 메시지 반환

```typescript
interface HandleMessageParams {
  sessionId: string;
  userMessage: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  systemPromptOverride?: string;
  chatId?: number | string;
}
```

---

## 4. Memory 모듈 (`src/memory/`)

### `createMemoryStore(dbPath: string): MemoryStore`

```typescript
interface MemoryStore {
  createSession(title?: string): Session;
  listSessions(): Session[];
  getSession(id: string): Session | null;
  deleteSession(id: string): void;
  addMessage(params: AddMessageParams): void;
  getMessages(sessionId: string, limit?: number): ChatMessage[];
  searchMessages(query: string, limit?: number): SearchResult[];
  buildContext(sessionId: string, maxSize: number): ChatMessage[];
  close(): void;
  getDb(): DatabaseSync;
}
```

- `buildContext`: 최근 N개 메시지 반환 (tool_calls + tool 결과는 분리 금지)
- `searchMessages`: `LIKE '%query%'` 키워드 검색, 최신순

### `createProviderStore(db: DatabaseSync): ProviderStore`

```typescript
interface ProviderStore {
  listProviders(): Provider[];
  getProvider(id: string): Provider | null;
  getDefaultProvider(): Provider | null;
  addProvider(params: AddProviderParams): Provider;
  updateProvider(id: string, params: Partial<Pick<Provider, "name" | "baseUrl" | "apiKey" | "model">>): Provider | null;
  deleteProvider(id: string): void;
  setDefault(id: string): Provider | null;
}
```

---

## 5. Tools 모듈 (`src/tools/`)

### `createToolExecutor(config: ToolsConfig, workspace: string, sender?: ChannelSender): ToolExecutor`

```typescript
interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
  getDefinitions(): ToolDefinition[];
  needsConfirmation(toolName: string): boolean;
  updateSender(sender: ChannelSender): void;
}

interface ChannelSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
  sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void>;
}
```

| 도구 | 입력 | 비고 |
|------|------|------|
| `shell` | `{ command, timeout? }` | workspace 내에서만 |
| `read_file` | `{ path }` | workspace 내 경로만 |
| `write_file` | `{ path, content }` | workspace 내 경로만 |
| `list_directory` | `{ path, recursive? }` | workspace 내 경로만 |
| `web_fetch` | `{ url, maxLength? }` | HTML→텍스트 변환 |
| `web_search` | `{ query, maxResults? }` | DuckDuckGo API |
| `http_request` | `{ url, method, headers?, body? }` | SSRF 필터 |
| `send_message` | `{ chatId, text }` | WebSocket 브로드캐스트 |
| `send_image` | `{ chatId, source, caption? }` | URL 또는 workspace 내 파일 |
| `browser_screenshot` | `{ url }` | Playwright (선택적) |
| `browser_execute` | `{ script }` | Playwright (선택적) |

- 비활성화된 도구는 `getDefinitions()`에서 제외
- `requireConfirmation`에 등록된 도구는 확인 필요

---

## 6. Channel 모듈 (`src/channel/`)

### `createWebSocketChannel(config, deps): WebSocketChannel`

```typescript
interface WebSocketChannel {
  start(): Promise<void>;
  stop(): Promise<void>;
  authService: AuthService;
  broadcastMessage(text: string): void;
}
```

- WebSocket + HTTP 서버 (포트 9800)
- PIN 기반 페어링 인증
- 실시간 스트리밍 채팅 (WebSocket)
- REST API로 세션/프로바이더 관리

### 인증 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/auth/pair/init` | POST | 페어링 PIN 생성 |
| `/api/auth/pair/verify` | POST | PIN 검증 + 토큰 발급 |
| `/api/auth/refresh` | POST | 액세스 토큰 갱신 |
| `/api/auth/unpair` | DELETE | 기기 연결 해제 |

### 세션 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/sessions` | GET | 세션 목록 |
| `/api/sessions` | POST | 세션 생성 |
| `/api/sessions/:id` | DELETE | 세션 삭제 |

### 프로바이더 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/providers` | GET | 프로바이더 목록 |
| `/api/providers` | POST | 프로바이더 생성 (자동 검증) |
| `/api/providers/:id` | PUT | 프로바이더 수정 |
| `/api/providers/:id` | DELETE | 프로바이더 삭제 |
| `/api/providers/current` | PUT | 활성 프로바이더 전환 |
| `/api/providers/:id/verify` | POST | 연결 확인 |
| `/api/providers/:id/models` | GET | 모델 목록 조회 |

### 푸시 토큰 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/push-tokens` | POST | 푸시 토큰 등록 |
| `/api/push-tokens` | DELETE | 푸시 토큰 해제 |

### 기타

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/status` | GET | 서버 상태 확인 |

---

## 7. Notification 모듈 (`src/notification/`)

### `createNotificationService(config, tokenStore): NotificationService`

```typescript
interface NotificationService {
  send(message: PushMessage): Promise<PushTicket>;
  sendAll(messages: PushMessage[]): Promise<PushTicket[]>;
  notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}
```

- Expo 푸시 알림 서비스
- 자동 청크 전송
- DeviceNotRegistered 시 토큰 자동 제거

### `createPushTokenStore(filePath?): PushTokenStore`

```typescript
interface PushTokenStore {
  register(token: string, platform: "ios" | "android" | "web", label: string): void;
  unregister(token: string): boolean;
  getAll(): PushTokenRecord[];
  getByToken(token: string): PushTokenRecord | undefined;
  touchLastUsed(token: string): void;
}
```

- 디스크 영속화 (`~/.openflow/push-tokens.json`)
- 재시작 후에도 토큰 유지

---

## 모듈 간 호출 흐름

```
모바일 앱 WebSocket/HTTP 요청
  → channel/websocket/server.ts: 수신
    → channel/websocket/ws-handler.ts: 인증 + 메시지 분배
      → agent/engine.ts: handleMessage()
        → memory/store.ts: addMessage() + buildContext()
        → llm/client.ts: chat() (도구 정의 포함)
          → tool_calls 반환 시
            → tools/executor.ts: execute()
            → llm/client.ts: 재요청
        → 최종 응답
      → channel/websocket/streaming.ts: 토큰 스트리밍 + 최종 응답
    → memory/store.ts: addMessage() (응답 저장)
    → notification/push-service.ts: notifyAll() (시작/종료 알림)
```
