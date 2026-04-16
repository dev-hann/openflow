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

- 우선순위: `--config` CLI 인자 > `OPENFLOW_CONFIG` env > `~/.openflow/openflow.json`

### `OpenFlowConfig` 타입

```typescript
interface OpenFlowConfig {
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  telegram: {
    botToken: string;
    allowedUsers: number[];
  };
  agent: {
    systemPrompt: string;
    maxToolRounds: number;
    workspace: string;
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

---

## 3. Agent 모듈 (`src/agent/`)

### `createAgentEngine(deps: AgentDeps): AgentEngine`

```typescript
interface AgentEngine {
  handleMessage(params: HandleMessageParams): Promise<AgentResponse>;
}
```

에이전트 루프 계약:
1. 메시지를 메모리에 저장
2. 컨텍스트 빌드 (시스템 프롬프트 + 대화 기록 + 도구 정의)
3. LLM 호출
4. `tool_calls` 응답 → 도구 실행 → 결과 추가 → 3번 반복
5. 텍스트 응답 → 반환
6. `maxToolRounds` 초과 시 에러 메시지 반환

---

## 4. Memory 모듈 (`src/memory/`)

### `createMemoryStore(dbPath: string): MemoryStore`

```typescript
interface MemoryStore {
  createSession(title?: string): Promise<Session>;
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  addMessage(params: AddMessageParams): Promise<void>;
  getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  searchMessages(query: string, limit?: number): Promise<SearchResult[]>;
  buildContext(sessionId: string, maxSize: number): Promise<ChatMessage[]>;
}
```

- `buildContext`: 최근 N개 메시지 반환 (tool_calls + tool 결과는 분리 금지)
- `searchMessages`: `LIKE '%query%'` 키워드 검색, 최신순

---

## 5. Tools 모듈 (`src/tools/`)

### `createToolExecutor(config: ToolsConfig): ToolExecutor`

```typescript
interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
  getDefinitions(): ToolDefinition[];
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
| `send_message` | `{ chatId, text }` | allowedUsers만 |

- 비활성화된 도구는 `getDefinitions()`에서 제외

---

## 6. Channel 모듈 (`src/channel/`)

### `createTelegramChannel(config, handler): TelegramChannel`

```typescript
interface TelegramChannel {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(params: SendParams): Promise<void>;
  editMessage(params: EditParams): Promise<void>;
}
```

- long-polling 루프로 메시지 수신
- `allowedUsers` 외 사용자 무시
- 인라인 명령(`/new`, `/reset`, `/help`)은 채널에서 직접 처리
- 스트리밍: 최소 500ms 간격으로 `editMessage`

---

## 모듈 간 호출 흐름

```
사용자 Telegram 메시지
  → channel/telegram.ts: 수신
    → agent/engine.ts: handleMessage()
      → memory/store.ts: addMessage() + buildContext()
      → llm/client.ts: chat() (도구 정의 포함)
        → tool_calls 반환 시
          → tools/executor.ts: execute()
          → llm/client.ts: 재요청
      → 최종 응답
    → channel/telegram.ts: sendMessage()
    → memory/store.ts: addMessage() (응답 저장)
```
