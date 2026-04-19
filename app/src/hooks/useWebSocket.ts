import { useState, useEffect, useRef, useCallback } from "react";
import type { WsServerMessage } from "../types/protocol";
import { normalizeUrl } from "../utils/normalize-url";
import { useAuthStore } from "../store/auth";
import { useChatStore } from "../store/chat";
import { useSessionsStore } from "../store/sessions";

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: Record<string, unknown>) => void;
  reconnect: () => void;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

function buildWsUrl(serverUrl: string): string {
  return normalizeUrl(serverUrl).replace(/^http/, "ws") + "/ws";
}

function getBackoffDelay(count: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, count);
  const jitter = delay * 0.2 * Math.random();
  return Math.min(delay + jitter, MAX_DELAY_MS);
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount = useRef(0);
  const intentionalClose = useRef(false);
  const authFailed = useRef(false);
  const [connected, setConnected] = useState(false);

  const storedAuth = useAuthStore((s) => s.storedAuth);
  const getValidToken = useAuthStore((s) => s.getValidToken);
  const setStoreConnected = useAuthStore((s) => s.setConnected);
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage);
  const finalizeLastMessage = useChatStore((s) => s.finalizeLastMessage);
  const setSending = useChatStore((s) => s.setSending);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);

  const handleMessageRef = useRef<(msg: WsServerMessage) => void>(() => {});
  handleMessageRef.current = (msg: WsServerMessage) => {
    switch (msg.type) {
      case "token":
        appendToLastMessage(msg.content);
        break;
      case "response":
        finalizeLastMessage(msg.content);
        setSending(false);
        break;
      case "error":
        finalizeLastMessage(`Error: ${msg.message}`);
        setSending(false);
        break;
      case "session_switched":
        setActiveSessionId(msg.sessionId);
        break;
      case "auth_required":
      case "pong":
      case "auth_ok":
        break;
    }
  };

  const getValidTokenRef = useRef(getValidToken);
  getValidTokenRef.current = getValidToken;
  const setStoreConnectedRef = useRef(setStoreConnected);
  setStoreConnectedRef.current = setStoreConnected;

  const clearPingTimer = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  const startPing = useCallback((ws: WebSocket) => {
    clearPingTimer();
    pingTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }, [clearPingTimer]);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    clearPingTimer();
    if (wsRef.current) {
      intentionalClose.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearPingTimer]);

  const connectRef = useRef<(wsUrl: string, scheduleReconnect: () => void) => void>(() => {});
  connectRef.current = (wsUrl: string, scheduleReconnect: () => void) => {
    intentionalClose.current = false;
    authFailed.current = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      try {
        const token = await getValidTokenRef.current();
        if (!token) {
          ws.close(4001, "no valid token");
          return;
        }
        ws.send(JSON.stringify({ type: "auth", accessToken: token }));
      } catch {
        ws.close(4001, "token fetch failed");
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data as string) as WsServerMessage;
      } catch {
        return;
      }
      if (msg.type === "auth_ok") {
        retryCount.current = 0;
        setConnected(true);
        setStoreConnectedRef.current(true);
        startPing(ws);
        return;
      }
      if (msg.type === "auth_required") {
        getValidTokenRef.current().then((token) => {
          if (token && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "auth", accessToken: token }));
          }
        });
        return;
      }
      handleMessageRef.current?.(msg);
    };

    ws.onclose = (event: CloseEvent) => {
      clearPingTimer();
      setConnected(false);
      setStoreConnectedRef.current(false);
      if (event.code === 4001) {
        authFailed.current = true;
        return;
      }
      if (!intentionalClose.current) {
        retryCount.current++;
        reconnectTimer.current = setTimeout(scheduleReconnect, getBackoffDelay(retryCount.current));
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  const stableConnect = useCallback((wsUrl: string, scheduleReconnect: () => void) => {
    connectRef.current?.(wsUrl, scheduleReconnect);
  }, []);

  useEffect(() => {
    if (!storedAuth) return;
    const wsUrl = buildWsUrl(storedAuth.serverUrl);
    const scheduleReconnect = () => stableConnect(wsUrl, scheduleReconnect);
    stableConnect(wsUrl, scheduleReconnect);
    return () => { cleanup(); };
  }, [storedAuth, stableConnect, cleanup]);

  const reconnect = useCallback(() => {
    cleanup();
    retryCount.current = 0;
    authFailed.current = false;
    if (!storedAuth) return;
    const wsUrl = buildWsUrl(storedAuth.serverUrl);
    const scheduleReconnect = () => reconnect();
    stableConnect(wsUrl, scheduleReconnect);
  }, [storedAuth, cleanup, stableConnect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected: connected, send, reconnect };
}
