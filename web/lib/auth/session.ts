import "server-only";

export type SessionRole = "user" | "admin";

export const SESSION_COOKIE = "motostar_session";
const SESSION_MAX_AGE_DAYS = 14;
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

export const createSessionValue = (role: SessionRole) => `${role}.${Date.now()}`;

export const parseSessionValue = (value?: string | null): SessionRole | null => {
  if (!value) return null;
  const [role, timestamp] = value.split(".");
  if (role !== "user" && role !== "admin") return null;
  if (!timestamp) return null;
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) return null;
  const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
  if (Date.now() - issuedAt > maxAgeMs) return null;
  return role;
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
});
