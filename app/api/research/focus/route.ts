import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const FOCUS_KEY = "research:focus";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const topics: string[] = (body.topics ?? []).filter(
    (t: unknown) => typeof t === "string" && (t as string).trim()
  );
  await kv.set(FOCUS_KEY, JSON.stringify(topics));
  return NextResponse.json({ ok: true, topics });
}
