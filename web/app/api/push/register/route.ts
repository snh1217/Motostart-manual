import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";

const hasSupabaseEnv = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
);

const ratelimit =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(30, "5 m"),
        analytics: true,
      })
    : null;

const schema = z.object({
  token: z.string().regex(/^ExponentPushToken\[[^\]]+\]$/),
  platform: z.enum(["ios", "android"]).optional(),
  appVersion: z.string().optional(),
});

type PushRegisterPayload = z.infer<typeof schema>;

export async function POST(request: Request) {
  if (ratelimit) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }

  if (isReadOnlyMode()) {
    return NextResponse.json({ error: "read_only_mode" }, { status: 503 });
  }

  if (!hasSupabaseEnv) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 501 });
  }

  let payload: PushRegisterPayload;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    token: payload.token,
    platform: payload.platform ?? null,
    app_version: payload.appVersion ?? null,
    user_id: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("push_tokens").upsert([row], {
    onConflict: "token",
  });

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
