import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionValue } from "../../../../lib/auth/session";
import {
  readLoginCodes,
  resolveLoginCodes,
  writeLoginCodes,
  type UserLoginCode,
} from "../../../../lib/auth/loginCodes";

const ensureAdmin = async () => {
  const cookieStore = await cookies();
  const role = parseSessionValue(cookieStore.get(SESSION_COOKIE)?.value ?? null);
  return role === "admin";
};

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const resolved = await resolveLoginCodes();
  return NextResponse.json({
    adminLoginToken: resolved.adminLoginToken ?? "",
    userCodes: resolved.userCodes ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { adminLoginToken?: string; userCodes?: UserLoginCode[] } = {};
  try {
    body = (await request.json()) as { adminLoginToken?: string; userCodes?: UserLoginCode[] };
  } catch {
    body = {};
  }

  const normalize = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  const hasAdminLoginToken = Object.prototype.hasOwnProperty.call(
    body,
    "adminLoginToken"
  );
  const hasUserCodes = Object.prototype.hasOwnProperty.call(body, "userCodes");

  const current = await readLoginCodes();
  const nextCodes = { ...current };

  if (hasAdminLoginToken) {
    const value = normalize(body.adminLoginToken);
    if (value) nextCodes.adminLoginToken = value;
    else delete nextCodes.adminLoginToken;
  }
  if (hasUserCodes) {
    nextCodes.userCodes = Array.isArray(body.userCodes) ? body.userCodes : [];
  }

  try {
    await writeLoginCodes(nextCodes);
    const resolved = await resolveLoginCodes();
    return NextResponse.json({
      adminLoginToken: resolved.adminLoginToken ?? "",
      userCodes: resolved.userCodes ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: 500 }
    );
  }
}
