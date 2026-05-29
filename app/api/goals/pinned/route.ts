import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { pinnedGoalsKey, DEFAULT_PINNED_GOALS } from "@/lib/pinned-goals";
import { getUserId } from "@/lib/auth-util";
import type { PinnedGoal } from "@/lib/pinned-goals";

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const raw = await kv.get<string>(pinnedGoalsKey(auth.userId));
  const goals: PinnedGoal[] = raw
    ? typeof raw === "string" ? JSON.parse(raw) : (raw as PinnedGoal[])
    : DEFAULT_PINNED_GOALS;
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const body = await req.json();
  const goals: PinnedGoal[] = (body.goals ?? []).slice(0, 3).map(
    (g: PinnedGoal, i: number) => ({
      id: g.id ?? `pinned-${i + 1}`,
      title: g.title ?? "",
      horizon: g.horizon ?? "",
    })
  );
  await kv.set(pinnedGoalsKey(auth.userId), JSON.stringify(goals));
  return NextResponse.json({ goals });
}
