import { useState, useEffect, useRef, useCallback } from "react";
import type { WsServerMessage } from "../types/protocol";
import { useAuthStore } from "../store/auth";
import { useChatStore } from "../store/chat";

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: Record<string, unknown>) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setLocalConnected] = useState(false);

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
            setLocalConnected(true);
            setStoreConnected(true);
            return;
          }
        } catch {
          // ignore
        }
        handleMessage(event);
      };

      ws.onclose = () => {
        setLocalConnected(false);
        setStoreConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current ?? undefined);
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
