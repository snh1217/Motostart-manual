import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionValue } from "../../../../lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const role = parseSessionValue(sessionValue);
  return NextResponse.json({ loggedIn: Boolean(role), role });
}
