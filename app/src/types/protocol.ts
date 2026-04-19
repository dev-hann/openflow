export interface WsChatMessage {
  type: "message";
  sessionId?: string;
  content: string;
}

export interface WsSwitchSession {
  type: "switch_session";
  sessionId: string;
}

export interface WsPing {
  type: "ping";
}

export type WsClientMessage = WsChatMessage | WsSwitchSession | WsPing;

export interface WsTokenChunk {
  type: "token";
  sessionId: string;
  content: string;
}

export interface WsResponse {
  type: "response";
  sessionId: string;
  content: string;
}

export interface WsError {
  type: "error";
  sessionId?: string;
  code: string;
  message: string;
}

export interface WsAuthRequired {
  type: "auth_required";
}

export interface WsAuthOk {
  type: "auth_ok";
}

export interface WsSessionSwitched {
  type: "session_switched";
  sessionId: string;
}

export interface WsPong {
  type: "pong";
}

export type WsServerMessage =
  | WsTokenChunk
  | WsResponse
  | WsError
  | WsAuthRequired
  | WsAuthOk
  | WsSessionSwitched
  | WsPong;

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionKey: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface StoredAuth {
  serverUrl: string;
  accessToken: string;
  refreshToken: string;
  sessionKey: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isStoredAuth(value: unknown): value is StoredAuth {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isString(v.serverUrl) &&
    isString(v.accessToken) &&
    isString(v.refreshToken) &&
    isString(v.sessionKey) &&
    isNumber(v.accessExpiresAt) &&
    isNumber(v.refreshExpiresAt)
  );
}
