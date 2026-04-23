export interface ErrorResponse {
  error: string;
  message?: string;
}

export interface PairInitResponse {
  expiresInMs: number;
}

export interface PairVerifyRequest {
  pin: string;
  label?: string;
}

export interface WebAuthInitResponse {
  sessionId: string;
  expiresInMs: number;
}

export interface WebAuthStatusResponse {
  status: "pending" | "approved" | "expired";
  accessToken?: string;
  refreshToken?: string;
  sessionKey?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  sessionKey: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
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

export type WsServerMessage =
  | { type: "token"; sessionId: string; content: string }
  | { type: "response"; sessionId: string; content: string }
  | { type: "error"; sessionId?: string; code: string; message: string }
  | { type: "auth_required" }
  | { type: "auth_ok" }
  | { type: "session_switched"; sessionId: string }
  | { type: "pong" }
  | { type: "notification"; message: string };

export type WsClientMessage =
  | { type: "message"; sessionId?: string; content: string }
  | { type: "switch_session"; sessionId: string }
  | { type: "ping" };

export type WsAuthMessage = { type: "auth"; accessToken: string };
