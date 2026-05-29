import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { getKBDoc } from "@/lib/kb";

// ── Legacy goal types (kept for existing API routes) ─────────────────────────
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

// ── Pinned goals (new panel) ──────────────────────────────────────────────────
export interface PinnedGoal {
  id: string;
  title: string;
  horizon: string;
}

export interface GoalAssessment {
  goal_id: string;
  goal_title: string;
  toward: string[];
  away: string[];
}

export interface GoalsAssessment {
  assessments: GoalAssessment[];
  generated_at: string;
}

export const PINNED_GOALS_KEY = "goals:pinned";
export const GOALS_ASSESSMENT_KEY = "goals:assessment";
const GOALS_ASSESSED_KEY = "goals:last_assessed";

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

export async function areGoalsStale(maxAgeHours = 20): Promise<boolean> {
  const ts = await kv.get<string>(GOALS_ASSESSED_KEY);
  if (!ts) return true;
  const ageHours = (Date.now() - new Date(ts as string).getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

const KB_SLUGS_FOR_GOALS = [
  "strategy/key-strategic-decisions",
  "strategy/competitive-positioning",
  "sales-distribution/membership-program",
  "brand-marketing/lifestyle-brand-strategy",
];

export async function autoAssessPinnedGoals(): Promise<GoalsAssessment> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  const [pinnedGoals, briefingRaw, ...kbDocs] = await Promise.all([
    getPinnedGoals(),
    kv.get<string>("briefing:latest"),
    ...KB_SLUGS_FOR_GOALS.map((s) => getKBDoc(s)),
  ]);

  // Recent briefing items for activity context
  const recentActivity: string[] = [];
  if (briefingRaw) {
    try {
      const b = typeof briefingRaw === "string" ? JSON.parse(briefingRaw) : briefingRaw;
      if (Array.isArray(b?.items)) {
        for (const item of b.items.slice(0, 8)) {
          recentActivity.push(`[${item.kind}] ${item.body}`);
        }
      }
    } catch {}
  }

  const kbContext = kbDocs
    .filter(Boolean)
    .map((d) => `## ${d!.title}\n${d!.content}`)
    .join("\n\n---\n\n");

  const goalsBlock = pinnedGoals
    .map((g) => `- ${g.title} (horizon: ${g.horizon})`)
    .join("\n");

  const activityBlock = recentActivity.length
    ? recentActivity.join("\n")
    : "No recent briefing available.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are assessing Mars Estate's progress toward its three most important long-term goals.

## Long-term goals
${goalsBlock}

## Recent activity (from inbox briefing)
${activityBlock}

## Strategic context (from knowledge base)
${kbContext}

For each goal, identify:
- 2-3 recent activities or projects actively moving TOWARD that goal
- 1-2 things that are a risk, gap, or moving AWAY from that goal

Be specific — reference actual projects, people, or items from the context above. Keep each bullet to one concise sentence.

Return ONLY a JSON array:
[
  {
    "goal_id": "<pinned-1 | pinned-2 | pinned-3>",
    "goal_title": "<exact goal title>",
    "toward": ["<bullet>", "<bullet>"],
    "away": ["<bullet>"]
  }
]`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON in goals assessment response");

  const assessments: GoalAssessment[] = JSON.parse(match[0]);
  const result: GoalsAssessment = {
    assessments,
    generated_at: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await Promise.all([
    kv.set(GOALS_ASSESSMENT_KEY, JSON.stringify(result)),
    kv.set(GOALS_ASSESSED_KEY, now),
  ]);

  return result;
}
