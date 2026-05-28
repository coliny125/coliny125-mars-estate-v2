import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// In-memory store for the briefing (reset on cold start)
interface BriefItem {
  id: string;
  kind: "decision" | "risk" | "opportunity" | "update";
  body: string;
  source_kind?: string;
  source_refs: { label: string }[];
  handled: boolean;
}

interface Briefing {
  id: string;
  generated_at: string;
  summary?: string;
  thread_count: number;
  meeting_count: number;
}

let cachedBriefing: Briefing | null = null;
let cachedItems: BriefItem[] = [];

export async function GET(req: NextRequest) {
  const includeHandled = req.nextUrl.searchParams.get("include_handled") === "1";
  const items = includeHandled ? cachedItems : cachedItems.filter((i) => !i.handled);
  return NextResponse.json({ briefing: cachedBriefing, items });
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are an operations assistant for Mars Estate, a Napa Valley winery on Howell Mountain.

Generate a realistic daily communications brief as if you had just reviewed emails and meeting notes.
Return a JSON object with this structure:
{
  "summary": "One sentence summary of the day",
  "thread_count": <number 3-8>,
  "meeting_count": <number 0-3>,
  "items": [
    {
      "id": "<uuid>",
      "kind": "decision|risk|opportunity|update",
      "body": "<actionable insight, 1-2 sentences>",
      "source_kind": "email|meeting|null",
      "source_refs": [{"label": "<source label>"}]
    }
  ]
}

Generate 4-6 realistic items about: harvest timing, DTC sales, wholesale relationships, tasting room, mailing list, vineyard management, regulatory compliance, or partnerships. Be specific and winery-relevant.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const data = JSON.parse(jsonMatch[0]);

    cachedBriefing = {
      id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
      summary: data.summary,
      thread_count: data.thread_count ?? 0,
      meeting_count: data.meeting_count ?? 0,
    };

    cachedItems = (data.items ?? []).map((item: Omit<BriefItem, "handled">) => ({
      ...item,
      id: item.id ?? crypto.randomUUID(),
      handled: false,
      source_refs: item.source_refs ?? [],
    }));

    return NextResponse.json({ briefing: cachedBriefing, items: cachedItems });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
