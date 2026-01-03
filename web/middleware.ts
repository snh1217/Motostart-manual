import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { SESSION_COOKIE, parseSessionValue } from "./lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  const isAuthPath = pathname === "/login" || pathname.startsWith("/api/auth");
  const isNextAsset = pathname.startsWith("/_next") || pathname === "/favicon.ico";
  const isStaticAsset = pathname.includes(".") && !pathname.startsWith("/api/");

  if (!isAuthPath && !isNextAsset && !isStaticAsset) {
    const sessionValue = request.cookies.get(SESSION_COOKIE)?.value ?? null;
    const role = parseSessionValue(sessionValue);
    if (!role) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "login_required" }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createMiddlewareClient({ req: request, res: response });
  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
