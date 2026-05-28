import { NextResponse } from "next/server";
import { isGmailConnected } from "@/lib/gmail";

export async function GET() {
  const connected = await isGmailConnected();
  return NextResponse.json({ connected });
}
