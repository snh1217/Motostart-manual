import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionValue,
  getSessionCookieOptions,
} from "../../../../lib/auth/session";
import { resolveLoginCodes } from "../../../../lib/auth/loginCodes";

export async function POST(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: string };
    token = body?.token?.trim() ?? "";
  } catch {
    token = "";
  }

  if (!token) {
    return NextResponse.json(
      { error: "로그인 코드를 입력해 주세요." },
      { status: 400 }
    );
  }

  const resolved = await resolveLoginCodes();
  const userCodes = resolved.userCodes ?? [];
  const adminLoginToken = resolved.adminLoginToken ?? "";
  const adminToken = process.env.ADMIN_TOKEN?.trim();

  const isAdmin = Boolean(adminLoginToken && token === adminLoginToken);
  const isUser = userCodes.some((entry) => entry.code === token && entry.active !== false);

  if (!isAdmin && !isUser) {
    return NextResponse.json(
      { error: "로그인 코드가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const role = isAdmin ? "admin" : "user";
  const sessionValue = createSessionValue(role);
  const response = NextResponse.json({
    ok: true,
    role,
    adminToken: role === "admin" ? adminToken ?? token : null,
    mode: userCodes.length || adminLoginToken ? "locked" : "open",
  });
  response.cookies.set(SESSION_COOKIE, sessionValue, getSessionCookieOptions());
  return response;
}
