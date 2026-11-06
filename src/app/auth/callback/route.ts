import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** อนุญาตเฉพาะ path ภายในแอป (ขึ้นต้น "/" แต่ไม่ใช่ "//" หรือ "/\") กัน open redirect */
function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/app";
  }
  return raw;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("redirect_to"));

  // Reconstruct origin from headers to handle proxies/production environments
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
