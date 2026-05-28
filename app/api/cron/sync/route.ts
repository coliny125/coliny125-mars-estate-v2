import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { fetchRecentThreads, isGmailConnected } from "@/lib/gmail";
import { todoStore } from "@/lib/storage";

export const maxDuration = 60;

const BRIEFING_KEY = "briefing:latest";

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

async function runSync(): Promise<StoredBriefing> {
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
        (t) =>
          `Subject: ${t.subject}\nFrom: ${t.from}\nDate: ${t.date}\nSnippet: ${t.snippet}`
      )
      .join("\n\n---\n\n");
  }

  // Also pull open todos for context
  const todos = await todoStore.list();
  const openTodos = todos
    .filter((t) => !t.done)
    .map((t) => `[${t.priority}] ${t.text}`)
    .join("\n");

  const prompt = connected
    ? `You are an operations assistant for Mars Estate, a Napa Valley winery on Howell Mountain.

Below are the ${threadCount} most recent inbox emails. Synthesize them into 4–7 actionable briefing items for the winery owner.

EMAILS:
${emailContext}

OPEN TODOS (for context, don't duplicate):
${openTodos}

Return a JSON object:
{
  "summary": "One sentence summary of today's communications",
  "items": [
    {
      "id": "<uuid>",
      "kind": "decision|risk|opportunity|update",
      "body": "<specific, actionable 1-2 sentence insight>",
      "source_kind": "email",
      "source_refs": [{"label": "<sender or subject>"}]
    }
  ]
}

Focus on items needing attention. Skip newsletters, payment receipts, and calendar notifications unless they require action.`
    : `You are an operations assistant for Mars Estate, a Napa Valley winery on Howell Mountain.

Gmail is not yet connected. Generate 4–5 placeholder briefing items based on typical winery operations in late May (pre-harvest season).

Return JSON: { "summary": "...", "items": [...] }`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const data = JSON.parse(jsonMatch[0]);

  const briefing: StoredBriefing = {
    id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    summary: data.summary ?? "",
    thread_count: threadCount,
    items: (data.items ?? []).map(
      (item: Omit<BriefItem, "handled">) => ({
        ...item,
        id: item.id ?? crypto.randomUUID(),
        handled: false,
        source_refs: item.source_refs ?? [],
      })
    ),
  };

  await kv.set(BRIEFING_KEY, briefing);
  return briefing;
}

// Called by Vercel Cron and by manual POST from the panel
export async function POST(req: NextRequest) {
  // Verify cron secret if called by Vercel scheduler
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isManual = req.headers.get("x-manual-trigger") === "1";

  if (!isManual && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const briefing = await runSync();
    return NextResponse.json({ ok: true, briefing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const briefing = await kv.get<StoredBriefing>(BRIEFING_KEY);
  return NextResponse.json({ briefing: briefing ?? null });
}
