import { kv } from "@vercel/kv";

export type GoalStatus = "on_track" | "at_risk" | "completed" | "blocked";

export interface Goal {
  id: string;
  title: string;
  description: string;
  target?: string;
  status: GoalStatus;
  notes?: string;
  updated_at: string;
}

export const GOALS_KEY = "goals:list";

export async function getGoals(): Promise<Goal[]> {
  const raw = await kv.get<string>(GOALS_KEY);
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : (raw as Goal[]);
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await kv.set(GOALS_KEY, JSON.stringify(goals));
}
