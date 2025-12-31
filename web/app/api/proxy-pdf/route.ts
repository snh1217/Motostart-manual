import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "MISSING_URL" }, { status: 400 });
  }

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseBase || !url.startsWith(supabaseBase)) {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 502 });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
