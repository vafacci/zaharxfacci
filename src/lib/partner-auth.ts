/**
 * Adgangskontrol til partner-siden. Fungerer i både proxy og route handlers (Web Crypto).
 * Låsen er kun aktiv, hvis PARTNER_ACCESS_CODE er sat (så lokal udvikling er fri).
 * Cookien er en HMAC bundet til koden – skifter I koden, bliver gamle cookies ugyldige.
 */
export const PARTNER_COOKIE = "partner_auth";
export const PARTNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const encoder = new TextEncoder();

export function gateEnabled(): boolean {
  return Boolean(process.env.PARTNER_ACCESS_CODE);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sessionToken(): Promise<string | null> {
  const secret = process.env.PARTNER_COOKIE_SECRET;
  const code = process.env.PARTNER_ACCESS_CODE;
  if (!secret || !code) return null;
  return hmacHex(secret, `facci-partner-v1:${code}`);
}

export async function codeMatches(input: string): Promise<boolean> {
  const secret = process.env.PARTNER_COOKIE_SECRET;
  const code = process.env.PARTNER_ACCESS_CODE;
  if (!secret || !code) return false;
  const normalize = (v: string) => v.trim().toLowerCase();
  const [a, b] = await Promise.all([
    hmacHex(secret, `code:${normalize(input)}`),
    hmacHex(secret, `code:${normalize(code)}`),
  ]);
  return constantTimeEqual(a, b);
}

export async function hasAccess(cookieValue: string | undefined): Promise<boolean> {
  if (!gateEnabled()) return true;
  const token = await sessionToken();
  if (!token || !cookieValue) return false;
  return constantTimeEqual(token, cookieValue);
}

/** Kun interne stier – undgår åbne redirects. */
export function safeNextPath(next: string | null | undefined): string {
  if (next && /^\/(partner|aftale)(\/|$)/.test(next) && !next.includes("//")) return next;
  return "/partner";
}
