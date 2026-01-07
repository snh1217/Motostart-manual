import "server-only";

import { SESSION_COOKIE, parseSessionValue } from "./session";

export const isReadOnlyMode = () => process.env.READ_ONLY_MODE === "1";

const getCookieValue = (cookieHeader: string | null, name: string) => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return part.slice(name.length + 1);
  }
  return null;
};

export const isAdminAuthorized = (request: Request) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;

  const cookieHeader = request.headers.get("cookie");
  const sessionValue = getCookieValue(cookieHeader, SESSION_COOKIE);
  const role = parseSessionValue(sessionValue);
  if (role === "admin") return true;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return false;
  return value === token;
};
