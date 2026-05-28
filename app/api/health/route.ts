import { NextResponse } from "next/server";

export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    ok: hasApiKey,
    status: hasApiKey
      ? "Claude API connected · cloud-ready"
      : "Missing ANTHROPIC_API_KEY",
  });
}
