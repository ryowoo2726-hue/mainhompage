import "server-only";
import { serverEnv } from "./env";

import { cookies } from "next/headers";

const SESSION_COOKIE = "student_attend_session";
const encoder = new TextEncoder();

function getSecret() {
  const secret = serverEnv().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 설정을 확인해주세요.");
  return secret;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getSessionTtlSeconds() {
  const minutes = Number(serverEnv().SESSION_TTL_MINUTES || "30");
  return Math.max(5, Math.min(480, minutes)) * 60;
}

export async function verifyPasscode(passcode: string) {
  const configuredHash = serverEnv().PASSCODE_HASH;
  const devPasscode = serverEnv().APP_PASSCODE;
  if (!configuredHash && !devPasscode) return false;
  const expectedHash = configuredHash || (await sha256Hex(devPasscode!));
  const incomingHash = await sha256Hex(passcode);
  return timingSafeEqual(incomingHash, expectedHash);
}

export async function createSessionCookie() {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + getSessionTtlSeconds() * 1000;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = await hmac(payload);
  const jar = await cookies();

  jar.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function isAuthenticated() {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return false;

  const [issuedAt, expiresAt, ...signatureParts] = value.split(".");
  const signature = signatureParts.join(".");
  if (!issuedAt || !expiresAt || !signature) return false;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;

  const expectedSignature = await hmac(`${issuedAt}.${expiresAt}`);
  return timingSafeEqual(signature, expectedSignature);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
