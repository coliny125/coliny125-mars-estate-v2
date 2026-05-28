import { NextRequest, NextResponse } from "next/server";
import { storeTokens } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?gmail_error=${error ?? "no_code"}`, req.url)
    );
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const data = await r.json();

  if (!data.refresh_token) {
    return NextResponse.redirect(
      new URL("/?gmail_error=no_refresh_token", req.url)
    );
  }

  await storeTokens(data.access_token, data.refresh_token, data.expires_in ?? 3600);

  return NextResponse.redirect(new URL("/?gmail_connected=1", req.url));
}
