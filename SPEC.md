# OpenFlow — Project Specification

> Ultra-lightweight personal AI assistant. 3-second startup. TypeScript ESM, Node.js 22+.

## Architecture

```
┌──────────────┐
│  Mobile App  │  Expo/React Native (SDK 54)
└──────┬───────┘
       │ WebSocket + REST API
┌──────▼───────┐
│  WS Channel  │  ws + HTTP server (:9800)
│  PIN Auth    │  6-digit pairing → JWT-like tokens
└──────┬───────┘
       │
┌──────▼───────┐
│ Agent Engine │  Tool call loop (max 10 rounds)
└──┬───┬───┬───┘
┌──▼─┐ ┌▼────┐ ┌▼─────────┐
│LLM │ │Mem  │ │Tools (11)│
│Pool│ │SQLite│ │Executor  │
└────┘ └─────┘ └──────────┘
```

**Module dependencies (unidirectional):**

```
bin → config
    → cli → channel → agent → llm
                           → tools
                           → memory
              notification
```

---

## CLI

| Flag | Description |
|------|-------------|
| `--config <path>` | Override config file path |
| `--verbose` | Set log level to debug |
| `--version`, `-v` | Print version |
| `--help`, `-h` | Print help |

On first run without config, auto-initializes `~/.openflow/openflow.json`.

---

## Configuration

Config file: `~/.openflow/openflow.json` (Zod validated, hot-reloaded via polling)

### LLM

| Key | Default | Description |
|-----|---------|-------------|
| `llm.maxTokens` | `4096` | Max response tokens |
| `llm.temperature` | `0.7` | Sampling temperature (0–2) |

### Agent

| Key | Default | Description |
|-----|---------|-------------|
| `agent.systemPrompt` | `""` | Additional system prompt |
| `agent.maxToolRounds` | `10` | Max tool call loop iterations |
| `agent.workspace` | `~/.openflow/workspace` | Workspace directory |
| `agent.dailyMemoryDays` | `2` (1–14) | Days of daily memory to load |

### Memory

| Key | Default | Description |
|-----|---------|-------------|
| `memory.contextSize` | `50` | Max messages in context window |
| `memory.dbPath` | `~/.openflow/memory.db` | SQLite database path |

### Tools

| Key | Default | Description |
|-----|---------|-------------|
| `tools.shell` | `{ enabled: true, timeout: 30000 }` | Shell command execution |
| `tools.webFetch` | `{ enabled: true }` | Web page fetching |
| `tools.webSearch` | `{ enabled: true }` | DuckDuckGo search |
| `tools.httpRequest` | `{ enabled: false }` | Generic HTTP client |
| `tools.browser` | `{ enabled: false, timeout: 30000, headless: true }` | Playwright browser |
| `tools.requireConfirmation` | `[]` | Tools requiring user approval |
| `tools.confirmationTimeout` | `60000` | Confirmation wait timeout (ms) |

### WebSocket

| Key | Default | Description |
|-----|---------|-------------|
| `websocket.enabled` | `true` | Enable WebSocket server |
| `websocket.host` | `"0.0.0.0"` | Listen address |
| `websocket.port` | `9800` | Listen port |
| `websocket.cors` | `true` | Enable CORS headers |

### Notification

| Key | Default | Description |
|-----|---------|-------------|
| `notification.enabled` | `true` | Enable push notifications |
| `notification.onStart` | `"🟢 OpenFlow가 시작되었습니다."` | Startup message |
| `notification.onStop` | `"🔴 OpenFlow가 종료됩니다."` | Shutdown message |

### Skills

| Key | Default | Description |
|-----|---------|-------------|
| `skills.enabled` | `true` | Enable skill system |
| `skills.extraDirs` | `[]` | Additional skill directories |
| `skills.entries` | `{}` | Per-skill enable/disable |

### Custom Commands

Arbitrary user-defined commands in config:

```json
{
  "commands": {
    "weather": {
      "action": "shell",
      "command": "curl -s wttr.in/Seoul?format=3",
      "description": "Current weather in Seoul",
      "timeout": 10000
    }
  }
}
```

Dangerous patterns are blocked (e.g., `rm -rf /`, `mkfs`, `curl | sh`).

---

## LLM Client

- **Protocol:** OpenAI Chat Completions API (`/chat/completions`)
- **Streaming:** SSE-based incremental token delivery (round 0 only)
- **Retry:** Exponential backoff `[1000, 2000, 4000]` ms, up to 3 retries on 5xx/network errors
- **Timeout:** 30 seconds per request
- **Multi-provider pool:** Switch between multiple LLM providers at runtime via REST API

### Provider Pool

Providers stored in SQLite `providers` table. Pool manages `LlmClient` instances per provider, with one active at a time. Switchable via API without restart.

---

## Agent Engine

### Loop

1. Save user message → memory
2. Build context (system prompt + history + workspace files + skills)
3. Call LLM with tool definitions
4. **If text response** → save, return to user
5. **If tool_calls** → execute each, append results, go to step 3
6. Abort after `maxToolRounds` (default 10)

Streaming tokens sent to client during round 0 only.

### System Prompt Assembly

Built dynamically from (conditional sections):

1. **Identity** — "You are OpenFlow, a personal AI assistant"
2. **Persona** — `PERSONA.md` contents
3. **User Profile** — `USER.md` contents
4. **Skills** — XML-formatted available skills list
5. **Memory** — `MEMORY.md` + recent daily memory files
6. **Daily Flush Instruction** — Save context at session end
7. **Runtime** — CWD, date, timezone

### Context Compaction

When estimated tokens exceed 30,000 (~4 chars/token):
- LLM generates summary preserving facts, decisions, file paths
- Keeps last 30% of messages after summary
- On failure, keeps original messages unchanged

### First-time Setup

If no `PERSONA.md` exists, agent enters setup mode with Korean-language prompt:
1. Asks name/nickname
2. Asks communication style (반말/존댓말)
3. Asks primary use cases
4. Creates `PERSONA.md` and `USER.md` via `write_file` tool

---

## Memory Store

SQLite via `node:sqlite` synchronous API. WAL mode, 5s busy timeout.

### Schema

```sql
sessions    (id PK, title, created_at, updated_at)
messages    (id PK, session_id FK→sessions, role, content,
             tool_call_id, tool_calls_json, created_at)
providers   (id PK, name, base_url, api_key, model, is_default,
             created_at, updated_at)
```

### Key Operations

| Operation | Description |
|-----------|-------------|
| `createSession()` | New session with UUID |
| `listSessions()` | All sessions |
| `addMessage()` | Insert message, touch session `updated_at` |
| `getMessages(id, limit)` | Last N messages in chronological order |
| `buildContext(id, maxSize)` | Paginated context window |
| `searchMessages(query)` | `LIKE` search with 40-char snippet |
| Provider CRUD | Full CRUD + `setDefault()` |

---

## Tools (11)

| Tool | Default | Description |
|------|---------|-------------|
| `shell` | On | Execute bash commands (workspace-scoped, 30s timeout, 10K char output) |
| `read_file` | Always | Read file contents (workspace-scoped, 50K char limit) |
| `write_file` | Always | Write file (auto-creates directories, workspace-scoped) |
| `list_directory` | Always | List directory entries (`/` suffix for dirs) |
| `web_fetch` | On | Fetch URL → stripped text (SSRF-protected, 10K chars) |
| `web_search` | On | DuckDuckGo HTML search (up to N results) |
| `http_request` | Off | Generic HTTP client (any method/headers/body, SSRF-protected) |
| `browser_screenshot` | Off | Headless Chromium screenshot via Playwright |
| `browser_execute` | Off | Run arbitrary Playwright script |
| `send_message` | Auto | Send text message via channel (when sender provided) |
| `send_image` | Auto | Send image via channel (URL or local path, when sender provided) |

### Security

- All file/shell tools scoped to `workspace` directory
- SSRF protection on web tools (blocks private networks: localhost, 10.x, 192.168.x, 172.16-31.x, .local, .internal)
- Dangerous shell patterns blocked in custom commands
- `requireConfirmation` config for tool approval gating

---

## WebSocket Channel

### Authentication — PIN Pairing

```
Server                        App
  │                             │
  │◄── POST /api/auth/pair/init ─│  (no auth)
  │── 6-digit PIN (console) ────│
  │                             │
  │◄── POST /api/auth/pair/verify│  { pin, label }
  │── access + refresh tokens ──│
  │                             │
  │◄── WS: { auth, accessToken }│
  │── WS: { auth_ok } ──────────│
```

- **Access token:** 1 hour TTL, HMAC-signed (`at_<b64>.<sig>`)
- **Refresh token:** 30 day TTL, SHA-256 hash stored in `~/.openflow/auth-store.json`
- Auth required within 10 seconds of WS connection

### WS Protocol

**Client → Server:**

| Type | Fields | Description |
|------|--------|-------------|
| `message` | `content, sessionId?` | Chat message |
| `switch_session` | `sessionId` | Switch active session |
| `ping` | — | Keep-alive |

**Server → Client:**

| Type | Fields | Description |
|------|--------|-------------|
| `token` | `sessionId, content` | Streaming token chunk |
| `response` | `sessionId, content` | Final response |
| `error` | `code, message, sessionId?` | Error notification |
| `auth_required` | — | Authentication needed |
| `auth_ok` | — | Auth successful |
| `session_switched` | `sessionId` | Session switched |
| `pong` | — | Keep-alive reply |

### REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/pair/init` | No | Create pairing PIN |
| POST | `/api/auth/pair/verify` | No | Verify PIN, issue tokens |
| POST | `/api/auth/refresh` | No | Refresh access token |
| DELETE | `/api/auth/unpair` | Yes | Remove device pairing |
| GET | `/api/sessions` | Yes | List sessions with counts |
| POST | `/api/sessions` | Yes | Create session |
| DELETE | `/api/sessions/:id` | Yes | Delete session |
| GET | `/api/providers` | Yes | List providers (masked keys) |
| POST | `/api/providers` | Yes | Create provider |
| PUT | `/api/providers/:id` | Yes | Update provider |
| DELETE | `/api/providers/:id` | Yes | Delete provider |
| PUT | `/api/providers/current` | Yes | Switch active provider |
| POST | `/api/providers/:id/verify` | Yes | Test provider connectivity |
| GET | `/api/providers/:id/models` | Yes | List available models |
| GET | `/api/status` | Yes | Health check |

Rate limit: 10 req/60s on auth endpoints per IP.

---

## Push Notifications

Expo push notifications via `expo-server-sdk`.

- Tokens stored in memory (reset on restart)
- Auto-unregister devices returning `DeviceNotRegistered`
- Startup/shutdown notifications sent to all registered devices
- `enabled: false` → all methods are no-ops

---

## Skills System

Skills provide specialized instructions the agent can load on demand.

### Skill Format

Each skill is a directory with a `SKILL.md`:

```markdown
---
name: "Skill Name"
description: "What this skill does"
---

Skill instructions in markdown...
```

### Discovery Paths (in order)

1. `config.skills.extraDirs` — user-specified directories
2. `~/.openflow/skills/` — global skills
3. `<workspace>/skills/` — workspace-local skills

Max skill file size: 256 KB. Skills listed in system prompt as XML; agent reads full SKILL.md via `read_file` when relevant.

---

## Workspace

```
~/.openflow/
├── openflow.json          # Configuration
├── memory.db              # SQLite database
├── auth-store.json        # Device tokens (mode 0o600)
└── workspace/
    ├── PERSONA.md         # AI personality/tone
    ├── USER.md            # User profile
    ├── MEMORY.md          # Long-term memory
    ├── daily/             # Daily memory files (YYYY-MM-DD.md)
    │   └── 2025-01-15.md
    └── skills/            # Local skill definitions
        └── my-skill/
            └── SKILL.md
```

### Memory Limits

| Setting | Value |
|---------|-------|
| Max daily file size | 1,200 chars |
| Max total daily memory | 2,800 chars |
| Max daily memory days | 14 |

---

## Companion App

Expo/React Native mobile app (`app/` directory):

- **Expo SDK 54**, React 19, React Native 0.81
- **State:** Zustand
- **Navigation:** React Navigation (bottom tabs + stack)
- **Markdown:** `react-native-markdown-display`
- **Secure storage:** `expo-secure-store` (tokens)
- **Build:** EAS Build for iOS/Android

---

## Error Codes

| Code | Description |
|------|-------------|
| `CONFIG_INVALID` | Config validation failed |
| `CONFIG_NOT_FOUND` | Config file missing |
| `LLM_REQUEST_FAILED` | LLM API call failed |
| `LLM_TIMEOUT` | LLM request timed out (30s) |
| `LLM_STREAM_ERROR` | SSE stream parsing error |
| `TOOL_EXECUTION_FAILED` | Tool execution error |
| `DB_ERROR` | SQLite operation failed |
| `DB_MIGRATION_FAILED` | Schema migration failed |
| `NOTIFICATION_ERROR` | Push notification failed |
| `PERMISSION_DENIED` | Auth/permission denied |

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `ws` | WebSocket server |
| `zod` | Schema validation |
| `pino` | Structured JSON logging |
| `expo-server-sdk` | Push notifications |
| `@clack/prompts` | CLI interactive prompts |
