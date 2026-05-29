import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { GOALS_ASSESSMENT_KEY } from "@/lib/goals";
import type { GoalsAssessment } from "@/lib/goals";

export async function GET() {
  const raw = await kv.get<string>(GOALS_ASSESSMENT_KEY);
  const assessment: GoalsAssessment | null = raw
    ? typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as GoalsAssessment)
    : null;
  return NextResponse.json({ assessment });
}
