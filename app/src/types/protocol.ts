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
