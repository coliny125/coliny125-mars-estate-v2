import { kv } from "@vercel/kv";

export interface PinnedGoal {
  id: string;
  title: string;
  horizon: string;
}

export const PINNED_GOALS_KEY = "goals:pinned";

export const DEFAULT_PINNED_GOALS: PinnedGoal[] = [
  {
    id: "pinned-1",
    title: "Become a top 5 Napa Valley estate within 5 years",
    horizon: "2027",
  },
  {
    id: "pinned-2",
    title: "Launch the Mars Founding Circle membership program",
    horizon: "Thanksgiving 2026",
  },
  {
    id: "pinned-3",
    title: "Establish Mars Estate as a lifestyle brand, not just a winery",
    horizon: "5-year horizon",
  },
];

export async function getPinnedGoals(): Promise<PinnedGoal[]> {
  const raw = await kv.get<string>(PINNED_GOALS_KEY);
  if (!raw) return DEFAULT_PINNED_GOALS;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as PinnedGoal[]);
}
