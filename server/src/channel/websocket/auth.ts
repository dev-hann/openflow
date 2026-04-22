import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { createLogger } from "../../utils/logger.js";
import type { components } from "../../generated/api.js";
import { createAuthStore, type AuthStore, type DeviceRecord } from "./auth-store.js";

const log = createLogger("ws/auth");

const PIN_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;

export type TokenPair = components["schemas"]["TokenPairResponse"];

export interface AccessTokenPayload {
  sessionKey: string;
  expiresAt: number;
}

interface PendingPin {
  pin: string;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
}

export interface AuthService {
  createPairingPin(): string;
  verifyPinAndIssueTokens(pin: string, label: string): TokenPair | null;
  validateAccessToken(token: string): AccessTokenPayload | null;
  refreshTokens(refreshToken: string): TokenPair | null;
  unpair(sessionKey: string): boolean;
  listDevices(): DeviceRecord[];
}

function generateToken(prefix: string, bytes: number): string {
  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const SIGNING_KEY = randomBytes(32);

function signPayload(payload: AccessTokenPayload): string {
  const json = JSON.stringify(payload);
  const sig = createHash("sha256").update(SIGNING_KEY).update(json).digest("hex").slice(0, 32);
  const encoded = Buffer.from(json, "utf-8").toString("base64url");
  return `at_${encoded}.${sig}`;
}

function decodeAccessToken(token: string): AccessTokenPayload | null {
  if (!token.startsWith("at_")) return null;
  try {
    const dotIdx = token.indexOf(".", 3);
    if (dotIdx === -1) return null;
    const encoded = token.slice(3, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const expectedSig = createHash("sha256")
      .update(SIGNING_KEY)
      .update(json)
      .digest("hex")
      .slice(0, 32);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(json) as AccessTokenPayload;
    if (typeof payload.sessionKey !== "string" || typeof payload.expiresAt !== "number")
      return null;
    return payload;
  } catch {
    log.debug("failed to decode access token");
    return null;
  }
}

export function createAuthService(store?: AuthStore): AuthService {
  const authStore = store ?? createAuthStore();
  const pendingPins = new Map<string, PendingPin>();
  let totalFailedAttempts = 0;

  function cleanExpiredPins(): void {
    const now = Date.now();
    for (const [key, pin] of pendingPins) {
      if (now > pin.expiresAt) {
        pendingPins.delete(key);
      }
    }
  }

  function createPairingPin(): string {
    cleanExpiredPins();
    totalFailedAttempts = 0;
    const pinRaw = randomBytes(3).readUIntBE(0, 3);
    const pin = String(100000 + (pinRaw % 900000));
    const now = Date.now();
    pendingPins.set(pin, {
      pin,
      createdAt: now,
      expiresAt: now + PIN_TTL_MS,
      claimed: false,
    });

    log.info({ pin: "***" }, "pairing pin created");

    const formatted = `${pin.slice(0, 3)} ${pin.slice(3)}`;
    const ttlMin = Math.round(PIN_TTL_MS / 60_000);
    const line1 = `   🔑 페어링 PIN:  ${formatted}`;
    const line2 = `   ${ttlMin}분 내 앱에서 입력하세요`;
    const w = Math.max(line1.length, line2.length) + 4;
    const border = "═".repeat(w);
    process.stdout.write(
      `\n  ╔${border}╗\n  ║${line1.padEnd(w)}║\n  ║${line2.padEnd(w)}║\n  ╚${border}╝\n\n`,
    );

    return pin;
  }

  function issueTokens(label: string): TokenPair {
    const sessionKey = generateToken("sk", 32);
    const refreshToken = generateToken("rt", 64);
    const now = Date.now();

    authStore.addDevice({
      sessionKey,
      refreshTokenHash: hashToken(refreshToken),
      label,
      pairedAt: now,
      lastSeen: now,
    });

    return {
      accessToken: signPayload({ sessionKey, expiresAt: now + ACCESS_TOKEN_TTL_MS }),
      refreshToken,
      sessionKey,
      accessExpiresAt: now + ACCESS_TOKEN_TTL_MS,
      refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
    };
  }

  function verifyPinAndIssueTokens(pin: string, label: string): TokenPair | null {
    cleanExpiredPins();
    if (totalFailedAttempts >= MAX_PIN_ATTEMPTS) {
      pendingPins.clear();
      return null;
    }

    const pending = pendingPins.get(pin);
    if (!pending) {
      totalFailedAttempts++;
      return null;
    }
    if (pending.claimed) {
      totalFailedAttempts++;
      return null;
    }
    if (Date.now() > pending.expiresAt) {
      pendingPins.delete(pin);
      totalFailedAttempts++;
      return null;
    }
    pending.claimed = true;
    pendingPins.delete(pin);
    totalFailedAttempts = 0;
    log.info({ label }, "PIN verified, tokens issued");
    return issueTokens(label);
  }

  function validateAccessToken(token: string): AccessTokenPayload | null {
    const payload = decodeAccessToken(token);
    if (!payload) return null;
    if (Date.now() > payload.expiresAt) return null;
    const device = authStore.findDeviceBySessionKey(payload.sessionKey);
    if (!device) return null;
    authStore.updateLastSeen(payload.sessionKey);
    return payload;
  }

  function refreshTokens(refreshToken: string): TokenPair | null {
    const hash = hashToken(refreshToken);
    const device = authStore.findDeviceByRefreshHash(hash);
    if (!device) {
      log.warn("refresh token not found or already rotated");
      return null;
    }

    const newAccessToken = signPayload({
      sessionKey: device.sessionKey,
      expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    const newRefreshToken = generateToken("rt", 64);
    authStore.updateRefreshHash(device.sessionKey, hashToken(newRefreshToken));

    log.info({ label: device.label }, "tokens refreshed");

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionKey: device.sessionKey,
      accessExpiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
      refreshExpiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    };
  }

  function unpair(sessionKey: string): boolean {
    return authStore.removeDevice(sessionKey);
  }

  function listDevices(): DeviceRecord[] {
    return authStore.listDevices();
  }

  return {
    createPairingPin,
    verifyPinAndIssueTokens,
    validateAccessToken,
    refreshTokens,
    unpair,
    listDevices,
  };
}
