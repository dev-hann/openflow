import { useState, useEffect, useRef, useCallback } from "react";
import type { WsServerMessage } from "../types/protocol";
import { useAuthStore } from "../store/auth";
import { useChatStore } from "../store/chat";

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: Record<string, unknown>) => void;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const MAX_RETRIES = 10;

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const [connected, setConnected] = useState(false);

  const storedAuth = useAuthStore((s) => s.storedAuth);
  const setStoreConnected = useAuthStore((s) => s.setConnected);
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage);
  const finalizeLastMessage = useChatStore((s) => s.finalizeLastMessage);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsServerMessage;
        switch (msg.type) {
          case "token":
            appendToLastMessage(msg.content);
            break;
          case "response":
            finalizeLastMessage(msg.content);
            break;
          case "error":
            finalizeLastMessage(`Error: ${msg.message}`);
            break;
          case "pong":
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    },
    [appendToLastMessage, finalizeLastMessage],
  );

  useEffect(() => {
    if (!storedAuth) return;

    const url = storedAuth.serverUrl.replace(/^http/, "ws");
    const wsUrl = `${url}/ws`;

    function getDelay(): number {
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount.current);
      const jitter = delay * 0.2 * Math.random();
      return Math.min(delay + jitter, MAX_DELAY_MS);
    }

    function connect(): void {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "auth",
          accessToken: storedAuth!.accessToken,
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          if (msg.type === "auth_ok") {
            retryCount.current = 0;
            setConnected(true);
            setStoreConnected(true);
            return;
          }
        } catch {
          // ignore
        }
        handleMessage(event);
      };

      ws.onclose = () => {
        setConnected(false);
        setStoreConnected(false);
        if (retryCount.current < MAX_RETRIES) {
          const delay = getDelay();
          retryCount.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [storedAuth, handleMessage, setStoreConnected]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected: connected, send };
}
