import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { GOALS_KEY } from "@/app/api/goals/route";
import type { Goal } from "@/app/api/goals/route";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const raw = await kv.get<string>(GOALS_KEY);
  const goals: Goal[] = raw
    ? typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as Goal[])
    : [];

  const updated = goals.map((g) =>
    g.id === params.id
      ? { ...g, ...body, id: g.id, updated_at: new Date().toISOString() }
      : g
  );

  await kv.set(GOALS_KEY, JSON.stringify(updated));
  const goal = updated.find((g) => g.id === params.id);
  return NextResponse.json({ goal: goal ?? null });
}
