import type { WsClientMessage, WsServerMessage } from "./types";

type WsListener = (msg: WsServerMessage) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;
const PING_INTERVAL_MS = 25_000;

export class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private url: string;
  private accessToken: string;

  constructor(url: string, accessToken: string) {
    this.url = url;
    this.accessToken = accessToken;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.send({ type: "auth", accessToken: this.accessToken } as unknown as WsClientMessage);
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as WsServerMessage;
          if (msg.type === "auth_ok") {
            this.reconnectAttempts = 0;
            this.startPing();
            resolve();
            return;
          }
          if (msg.type === "auth_required") {
            this.ws?.close(4001, "auth required");
            reject(new Error("Authentication failed"));
            return;
          }
          this.notify(msg);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.stopPing();
        if (!this.disposed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
      };
    });
  }

  send(msg: WsClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(fn: WsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  dispose(): void {
    this.disposed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }

  private notify(msg: WsServerMessage): void {
    for (const fn of this.listeners) fn(msg);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts) + Math.random() * 500,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.disposed) this.connect().catch(() => {});
    }, delay);
  }
}

export function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}
