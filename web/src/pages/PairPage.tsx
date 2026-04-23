import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type PairStatus = "loading" | "showing_qr" | "approved" | "expired" | "error";

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_FAILS = 3;

export function PairPage() {
  const [status, setStatus] = useState<PairStatus>("loading");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const sessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const failCountRef = useRef(0);
  const schedulePollFnRef = useRef<((id: string) => void) | null>(null);
  const setTokens = useAuthStore((s) => s.setTokens);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((expiresInMs: number) => {
    const expiresAt = Date.now() + expiresInMs;
    setCountdown(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setStatus("expired");
        clearTimers();
      }
    }, 1000);
  }, [clearTimers]);

  const scheduleNextPoll = useCallback((sessionId: string) => {
    pollTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const result = await api.webAuthStatus(sessionId);
        if (!mountedRef.current) return;
        failCountRef.current = 0;

        if (
          result.status === "approved" &&
          result.accessToken &&
          result.refreshToken &&
          result.sessionKey &&
          result.accessExpiresAt &&
          result.refreshExpiresAt
        ) {
          clearTimers();
          setTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            sessionKey: result.sessionKey,
            accessExpiresAt: result.accessExpiresAt,
            refreshExpiresAt: result.refreshExpiresAt,
          });
          setStatus("approved");
        } else if (result.status === "expired") {
          clearTimers();
          setStatus("expired");
        } else if (sessionIdRef.current === sessionId) {
          schedulePollFnRef.current?.(sessionId);
        }
      } catch {
        if (!mountedRef.current) return;
        failCountRef.current++;
        if (failCountRef.current >= MAX_CONSECUTIVE_FAILS) {
          clearTimers();
          setError("상태 확인에 실패했습니다");
          setStatus("error");
        } else if (sessionIdRef.current === sessionId) {
          schedulePollFnRef.current?.(sessionId);
        }
      }
    }, POLL_INTERVAL_MS);
  }, [clearTimers, setTokens]);

  useEffect(() => {
    schedulePollFnRef.current = scheduleNextPoll;
  }, [scheduleNextPoll]);

  const initSession = useCallback(async () => {
    setStatus("loading");
    setError("");
    clearTimers();
    failCountRef.current = 0;

    try {
      const result = await api.webAuthInit();
      if (!mountedRef.current) return;
      sessionIdRef.current = result.sessionId;

      const baseUrl = window.location.origin;
      const qrText = `${baseUrl}/web-auth?session=${result.sessionId}`;
      const dataUrl = await QRCode.toDataURL(qrText, {
        width: 256,
        margin: 2,
        color: { dark: "#ffffff", light: "#18181b" },
      });
      if (!mountedRef.current) return;

      setQrDataUrl(dataUrl);
      setStatus("showing_qr");
      startCountdown(result.expiresInMs);
      scheduleNextPoll(result.sessionId);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "세션 생성에 실패했습니다");
      setStatus("error");
    }
  }, [clearTimers, startCountdown, scheduleNextPoll]);

  const didInit = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!didInit.current) {
      didInit.current = true;
      initSession();
    }
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [initSession, clearTimers]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">OpenFlow</h1>
          <p className="text-zinc-400 text-sm" role="status" aria-live="polite">
            {status === "loading" && "QR 코드를 생성하는 중..."}
            {status === "showing_qr" && "휴대폰 앱으로 QR 코드를 스캔하세요"}
            {status === "approved" && "인증 완료!"}
            {status === "expired" && "QR 코드가 만료되었습니다"}
            {status === "error" && "오류가 발생했습니다"}
          </p>
        </div>

        {status === "loading" && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}

        {status === "showing_qr" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <img src={qrDataUrl} alt="OpenFlow 앱으로 스캔할 QR 코드" className="w-64 h-64" />
            </div>
            <p className="text-zinc-500 text-xs">
              만료까지 {formatCountdown(countdown)}
            </p>
          </div>
        )}

        {status === "approved" && (
          <div className="flex justify-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {(status === "expired" || status === "error") && (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-950/50 border border-red-900/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button
              onClick={initSession}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
