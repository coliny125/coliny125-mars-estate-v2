import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { goalsAssessmentKey, autoAssessPinnedGoals } from "@/lib/goals";
import { getUserId } from "@/lib/auth-util";
import type { GoalsAssessment } from "@/lib/goals";

export const maxDuration = 60;

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const raw = await kv.get<string>(goalsAssessmentKey(auth.userId));
  const assessment: GoalsAssessment | null = raw
    ? typeof raw === "string" ? JSON.parse(raw) : (raw as GoalsAssessment)
    : null;
  return NextResponse.json({ assessment });
}

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const assessment = await autoAssessPinnedGoals(auth.userId);
  return NextResponse.json({ assessment });
}
