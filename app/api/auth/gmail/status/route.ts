import { NextResponse } from "next/server";
import { isGmailConnected } from "@/lib/gmail";
import { getUserId } from "@/lib/auth-util";

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const connected = await isGmailConnected(auth.userId);
  return NextResponse.json({ connected });
}
