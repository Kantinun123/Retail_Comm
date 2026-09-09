import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  return NextResponse.redirect(`${origin}/auth/login`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  // Use 303 redirect for POST requests to ensure the browser follows with a GET
  return NextResponse.redirect(`${origin}/auth/login`, {
    status: 303,
  });
}
