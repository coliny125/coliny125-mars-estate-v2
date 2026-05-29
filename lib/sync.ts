import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { fetchRecentThreads, isGmailConnected } from "@/lib/gmail";
import { todoStore } from "@/lib/storage";

export interface BriefItem {
  id: string;
  kind: "decision" | "risk" | "opportunity" | "update";
  body: string;
  source_kind?: string;
  source_refs: { label: string }[];
  handled: boolean;
}

export interface StoredBriefing {
  id: string;
  generated_at: string;
  summary: string;
  thread_count: number;
  items: BriefItem[];
}

export const BRIEFING_KEY = "briefing:latest";

export async function runSync(): Promise<StoredBriefing> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  const connected = await isGmailConnected();
  let emailContext = "";
  let threadCount = 0;

  if (connected) {
    const threads = await fetchRecentThreads(40);
    threadCount = threads.length;
    emailContext = threads
      .map(
        (t, i) =>
          `[Thread ${i + 1}]\nSubject: ${t.subject}\nFrom: ${t.from}\nDate: ${t.date}\n\n${t.body}`
      )
      .join("\n\n---\n\n");
  }

  const todos = await todoStore.list();
  const openTodos = todos
    .filter((t) => !t.done)
    .map((t) => `[${t.priority}] ${t.text}`)
    .join("\n");

  const prompt = connected
    ? `You are the chief of staff for Mars Estate, a boutique Napa Valley winery on Howell Mountain. Your job is to produce a rigorous, actionable daily briefing for the owner (Colin Yuan) from his inbox.

## Mars Estate context
- 21.8-acre estate, Howell Mountain AVA, ~670 cases/year
- Key relationships: Heidi Barrett (winemaker), Steve Matthiasson (viticulturist), Offset Partners (brand/web), Canopy Wine Selections (NY distribution), Hare Construction, Walker Warner / Butler Armsden (architecture)
- Active projects: website launch, membership program (Founding Circle), DTC e-commerce (Offset Commerce), hospitality center planning, 2024 Chardonnay bottling (Jun 22)

## Your analytical framework
Before writing any output, work through these steps in your thinking:

1. READ EVERY THREAD carefully — do not skim. The body content matters more than subject lines.
2. CONNECT related threads — if two emails touch the same project or person, that is one briefing item, not two. Explicitly note the connection.
3. CLASSIFY by urgency and type:
   - RISK: something that could go wrong, cause financial loss, damage a relationship, or miss a deadline. Be specific about the consequence.
   - DECISION: something where Colin must choose between options or approve something to unblock progress.
   - OPPORTUNITY: something that could be acted on for meaningful gain if addressed soon.
   - UPDATE: progress worth knowing that requires no immediate action.
4. IGNORE: newsletters, automated notifications, payment confirmations (unless overdue), and calendar invites (unless they require a decision).
5. CROSS-REFERENCE with open todos — do not duplicate items already on the todo list unless there is new urgency or information.
6. PRIORITIZE: if more than 7 items surface, keep the 6-7 highest-stakes ones. Quality over quantity.

## Input

### Inbox (${threadCount} threads)
${emailContext}

### Open todos (for context — do not duplicate)
${openTodos || "None"}

## Output format
Return ONLY a valid JSON object:
{
  "summary": "<One sharp sentence capturing the dominant theme across today's inbox>",
  "items": [
    {
      "id": "<uuid>",
      "kind": "risk|decision|opportunity|update",
      "body": "<Specific, actionable 1-3 sentences. Name the person, the deadline, the consequence, or the dollar amount where known. No vague language.>",
      "source_kind": "email",
      "source_refs": [{"label": "<sender name or email subject — enough to identify the thread>"}]
    }
  ]
}`
    : `You are an operations assistant for Mars Estate, a Napa Valley winery on Howell Mountain.

Gmail is not connected. Generate 4–5 placeholder briefing items based on typical late-May winery operations.

Return JSON: { "summary": "...", "items": [...] }`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    thinking: {
      type: "enabled",
      budget_tokens: 5000,
    },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const data = JSON.parse(jsonMatch[0]);

  const briefing: StoredBriefing = {
    id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    summary: data.summary ?? "",
    thread_count: threadCount,
    items: (data.items ?? []).map((item: Omit<BriefItem, "handled">) => ({
      ...item,
      id: item.id ?? crypto.randomUUID(),
      handled: false,
      source_refs: item.source_refs ?? [],
    })),
  };

  await kv.set(BRIEFING_KEY, briefing);
  return briefing;
}
