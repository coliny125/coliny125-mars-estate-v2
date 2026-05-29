import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { fetchRecentThreads, isGmailConnected } from "@/lib/gmail";
import { todoStore } from "@/lib/storage";
import { enrichKBFromSync } from "@/lib/kb-enrich";

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

export function briefingKey(userId: string) {
  return `briefing:${userId}`;
}

export async function runSync(
  userId: string,
  opts: { extended?: boolean; userEmail?: string } = {}
): Promise<StoredBriefing> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  const connected = await isGmailConnected(userId);
  let emailContext = "";
  let threadCount = 0;

  if (connected) {
    const threads = await fetchRecentThreads(userId, 40);
    threadCount = threads.length;
    emailContext = threads
      .map(
        (t, i) =>
          `[Thread ${i + 1}]\nSubject: ${t.subject}\nFrom: ${t.from}\nDate: ${t.date}\n\n${t.body}`
      )
      .join("\n\n---\n\n");
  }

  const todos = await todoStore.list(userId);
  const openTodos = todos
    .filter((t) => !t.done)
    .map((t) => `[${t.priority}] ${t.text}`)
    .join("\n");

  const prompt = connected
    ? `You are the chief of staff for Mars Estate, a boutique Napa Valley winery on Howell Mountain. Your job is to produce a rigorous, actionable daily briefing from this user's inbox.

## Mars Estate context
- 21.8-acre estate, Howell Mountain AVA, ~670 cases/year
- Key relationships: Heidi Barrett (winemaker), Steve Matthiasson (viticulturist), Offset Partners (brand/web), Canopy Wine Selections (NY distribution), Hare Construction, Walker Warner / Butler Armsden (architecture)
- Active projects: website launch, membership program (Founding Circle), DTC e-commerce (Offset Commerce), hospitality center planning, 2024 Chardonnay bottling (Jun 22)

## Your analytical framework
1. READ EVERY THREAD carefully — body content matters more than subject lines.
2. CONNECT related threads — if two emails touch the same project or person, that is one briefing item.
3. CLASSIFY by urgency: RISK (consequence if ignored), DECISION (choice needed to unblock), OPPORTUNITY (act soon for gain), UPDATE (no action needed).
4. IGNORE newsletters, automated notifications, payment confirmations (unless overdue), calendar invites (unless they require a decision).
5. CROSS-REFERENCE with open todos — do not duplicate unless there is new urgency.
6. PRIORITIZE: keep the 6-7 highest-stakes items. Quality over quantity.

## Input

### Inbox (${threadCount} threads)
${emailContext}

### Open todos (for context — do not duplicate)
${openTodos || "None"}

## Output format
Return ONLY a valid JSON object:
{
  "summary": "<One sharp sentence capturing the dominant theme>",
  "items": [
    {
      "id": "<uuid>",
      "kind": "risk|decision|opportunity|update",
      "body": "<Specific, actionable 1-3 sentences. Name the person, deadline, consequence, or dollar amount. No vague language.>",
      "source_kind": "email",
      "source_refs": [{"label": "<sender name or subject>"}]
    }
  ]
}`
    : `You are an operations assistant for Mars Estate, a Napa Valley winery on Howell Mountain.

Gmail is not connected. Generate 4–5 placeholder briefing items based on typical late-May winery operations.

Return JSON: { "summary": "...", "items": [...] }`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: opts.extended ? 8000 : 2000,
    ...(opts.extended
      ? { thinking: { type: "enabled", budget_tokens: 5000 } }
      : {}),
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

  await kv.set(briefingKey(userId), briefing);

  // Enrich the shared KB from this user's inbox (fire-and-forget, don't block)
  if (emailContext && opts.userEmail) {
    enrichKBFromSync(userId, opts.userEmail, emailContext).catch(() => null);
  }

  return briefing;
}
