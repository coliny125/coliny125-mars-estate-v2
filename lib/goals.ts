import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { getKBDoc } from "@/lib/kb";
import { getPinnedGoals } from "@/lib/pinned-goals";
export type { PinnedGoal } from "@/lib/pinned-goals";
export { PINNED_GOALS_KEY, DEFAULT_PINNED_GOALS } from "@/lib/pinned-goals";

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

// ── Pinned goals assessment ───────────────────────────────────────────────────
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

export const GOALS_ASSESSMENT_KEY = "goals:assessment";
const GOALS_ASSESSED_KEY = "goals:last_assessed";

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

export async function autoAssessPinnedGoals(opts: { extended?: boolean } = {}): Promise<GoalsAssessment> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  // Load everything in parallel
  const [pinnedGoals, briefingRaw, todosRaw, researchRaw, ...kbDocs] =
    await Promise.all([
      getPinnedGoals(),
      kv.get<string>("briefing:latest"),
      kv.get<string>("todos"),
      kv.get<string>("research:latest"),
      ...KB_SLUGS_FOR_GOALS.map((s) => getKBDoc(s)),
    ]);

  // Briefing items
  const recentActivity: string[] = [];
  if (briefingRaw) {
    try {
      const b = typeof briefingRaw === "string" ? JSON.parse(briefingRaw) : briefingRaw;
      if (Array.isArray(b?.items)) {
        for (const item of b.items) {
          recentActivity.push(`[${item.kind.toUpperCase()}] ${item.body}`);
        }
      }
    } catch {}
  }

  // Open todos grouped by priority
  const openTodos: string[] = [];
  if (todosRaw) {
    try {
      const raw = typeof todosRaw === "string" ? JSON.parse(todosRaw) : todosRaw;
      if (Array.isArray(raw)) {
        for (const t of raw) if (!t.done) openTodos.push(`[${t.priority}] ${t.text}`);
      }
    } catch {}
  }

  // Research findings
  const researchFindings: string[] = [];
  if (researchRaw) {
    try {
      const r = typeof researchRaw === "string" ? JSON.parse(researchRaw) : researchRaw;
      if (Array.isArray(r?.items)) {
        for (const item of r.items.slice(0, 6)) {
          researchFindings.push(`${item.topic}: ${item.summary}`);
        }
      }
    } catch {}
  }

  const kbContext = kbDocs
    .filter(Boolean)
    .map((d) => `### ${d!.title}\n${d!.content}`)
    .join("\n\n---\n\n");

  const goalsBlock = pinnedGoals
    .map((g, i) => `Goal ${i + 1} (id: ${g.id}): ${g.title}\nHorizon: ${g.horizon}`)
    .join("\n\n");

  const prompt = `You are a strategic advisor to Mars Estate, a boutique Napa Valley winery on Howell Mountain. Your task is to rigorously assess the estate's real-world progress toward its three most important long-term goals.

## The three goals
${goalsBlock}

## Recent inbox briefing (what happened this week)
${recentActivity.length ? recentActivity.join("\n") : "No recent briefing available."}

## Open action items
${openTodos.length ? openTodos.join("\n") : "None."}

## Industry research (current market context)
${researchFindings.length ? researchFindings.join("\n") : "None."}

## Strategic knowledge base
${kbContext}

## Your analytical framework
Before writing your output, reason carefully through each goal using this rubric:

**For each goal, ask:**
1. What specific actions, projects, or decisions from the past week directly advance this goal? Only count things with real strategic weight — not routine admin.
2. What is actively blocking, delaying, or contradicting this goal? Be honest about gaps, overdue items, or structural risks.
3. Is the current pace consistent with the stated horizon? If not, say so.
4. Are there any cross-goal tensions — where progress on one goal creates friction with another?

**Quality criteria:**
- Every bullet must reference a specific person, project, deadline, or event from the context above.
- Avoid vague language ("working toward", "making progress"). Instead: "Ron Lutsko's $45K landscape plan is on track but no architecture firm has been selected, delaying hospitality center timeline."
- If something is genuinely unclear or data is missing, say so — do not fabricate.
- Toward bullets: 2-3, highest-signal only.
- Away bullets: 1-2, most critical risks or gaps only.

Return ONLY a valid JSON array — no other text:
[
  {
    "goal_id": "<exact id from goal list above>",
    "goal_title": "<exact goal title>",
    "toward": ["<specific bullet>", "<specific bullet>"],
    "away": ["<specific bullet>"]
  }
]`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: opts.extended ? 16000 : 2000,
    ...(opts.extended
      ? { thinking: { type: "enabled", budget_tokens: 10000 } }
      : {}),
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";
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
