import { NextRequest, NextResponse } from "next/server";

// Focus list is stored in the research route's module-level state.
// This is a stub that returns OK — in production, persist to a DB or env var.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true, topics: body.topics ?? [] });
}
