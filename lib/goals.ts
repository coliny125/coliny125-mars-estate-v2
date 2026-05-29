import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";

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
const GOALS_ASSESSED_KEY = "goals:last_assessed";

export async function getGoals(): Promise<Goal[]> {
  const raw = await kv.get<string>(GOALS_KEY);
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : (raw as Goal[]);
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await kv.set(GOALS_KEY, JSON.stringify(goals));
}

export async function areGoalsStale(maxAgeHours = 20): Promise<boolean> {
  const ts = await kv.get<string>(GOALS_ASSESSED_KEY);
  if (!ts) return true;
  const ageHours = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

export async function autoAssessGoals(): Promise<Goal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  const goals = await getGoals();
  if (goals.length === 0) return [];

  // Pull in current briefing and open todos for context
  const [briefingRaw, todosRaw] = await Promise.all([
    kv.get<string>("briefing:latest"),
    kv.get<string>("todos"),
  ]);

  const briefingItems: string[] = [];
  if (briefingRaw) {
    try {
      const b = typeof briefingRaw === "string" ? JSON.parse(briefingRaw) : briefingRaw;
      if (Array.isArray(b?.items)) {
        for (const item of b.items) briefingItems.push(`[${item.kind}] ${item.body}`);
      }
    } catch {}
  }

  const openTodos: string[] = [];
  if (todosRaw) {
    try {
      // Todos are stored as a Redis hash — KV returns the raw value
      const raw = typeof todosRaw === "string" ? JSON.parse(todosRaw) : todosRaw;
      if (Array.isArray(raw)) {
        for (const t of raw) if (!t.done) openTodos.push(`[${t.priority}] ${t.text}`);
      }
    } catch {}
  }

  const contextBlock = [
    briefingItems.length > 0
      ? `Recent briefing items:\n${briefingItems.slice(0, 10).join("\n")}`
      : "",
    openTodos.length > 0
      ? `Open todos:\n${openTodos.slice(0, 15).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const goalsBlock = goals
    .map(
      (g) =>
        `ID: ${g.id}\nGoal: ${g.title}\nTarget: ${g.target ?? "open"}\nCurrent status: ${g.status}\nCurrent notes: ${g.notes ?? "none"}`
    )
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are reviewing Mars Estate's long-term goals. Based on the current operational context below, assess each goal and return updated statuses and concise notes (1–2 sentences max).

## Operational context
${contextBlock || "No recent briefing or todos available."}

## Goals to assess
${goalsBlock}

Return ONLY a JSON array — one entry per goal — with exactly these fields:
[
  { "id": "<goal id>", "status": "<on_track|at_risk|completed|blocked>", "notes": "<1-2 sentence assessment>" }
]

Rules:
- Use "completed" only when the goal is definitively done.
- Use "blocked" when something external must happen first.
- Use "at_risk" when there are open blockers or overdue items.
- Use "on_track" when things are progressing normally.
- Keep existing status unless the context clearly indicates a change.
- Notes should be specific — reference actual items from the context when relevant.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return goals;

  const assessments: { id: string; status: GoalStatus; notes: string }[] =
    JSON.parse(match[0]);

  const assessmentMap = new Map(assessments.map((a) => [a.id, a]));
  const now = new Date().toISOString();

  const updated = goals.map((g) => {
    const a = assessmentMap.get(g.id);
    if (!a) return g;
    return { ...g, status: a.status, notes: a.notes, updated_at: now };
  });

  await Promise.all([
    saveGoals(updated),
    kv.set(GOALS_ASSESSED_KEY, now),
  ]);

  return updated;
}
