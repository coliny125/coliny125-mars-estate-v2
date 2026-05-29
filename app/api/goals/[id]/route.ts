import { NextRequest, NextResponse } from "next/server";
import { getGoals, saveGoals } from "@/lib/goals";
import type { Goal } from "@/lib/goals";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const goals = await getGoals();

  const updated = goals.map((g) =>
    g.id === params.id
      ? { ...g, ...(body as Partial<Goal>), id: g.id, updated_at: new Date().toISOString() }
      : g
  );

  await saveGoals(updated);
  const goal = updated.find((g) => g.id === params.id);
  return NextResponse.json({ goal: goal ?? null });
}
