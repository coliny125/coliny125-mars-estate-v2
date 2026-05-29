import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { RESEARCH_KEY, FOCUS_KEY } from "@/lib/research";
import type { ResearchItem, ResearchData } from "@/lib/research";

const DEFAULT_FOCUS = [
  "Howell Mountain AVA pricing trends",
  "Napa Valley harvest outlook",
  "DTC wine sales and direct-to-consumer regulations",
];

export async function GET() {
  const [raw, focusRaw] = await Promise.all([
    kv.get<string>(RESEARCH_KEY),
    kv.get<string>(FOCUS_KEY),
  ]);

  const stored = raw
    ? typeof raw === "string"
      ? (JSON.parse(raw) as ResearchData)
      : (raw as ResearchData)
    : null;

  const focus = focusRaw
    ? typeof focusRaw === "string"
      ? (JSON.parse(focusRaw) as string[])
      : (focusRaw as string[])
    : DEFAULT_FOCUS;

  return NextResponse.json({
    items: stored?.items ?? [],
    focus,
    generated_at: stored?.generated_at ?? null,
  });
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const focusRaw = await kv.get<string>(FOCUS_KEY);
  const focus = focusRaw
    ? typeof focusRaw === "string"
      ? (JSON.parse(focusRaw) as string[])
      : (focusRaw as string[])
    : DEFAULT_FOCUS;

  if (focus.length === 0) {
    return NextResponse.json({ error: "No focus topics configured" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a research assistant for Mars Estate, a premium Napa Valley winery on Howell Mountain.

Research the following topics and provide actionable intelligence relevant to a boutique winery operation:
${focus.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return a JSON array of research items:
[
  {
    "topic": "<topic name>",
    "summary": "<2-3 sentence synthesis with specific, current, winery-relevant insights>",
    "bullets": ["<specific data point or action>", "<specific data point or action>"],
    "source": "Industry analysis"
  }
]

Be specific, actionable, and grounded in real winery/wine industry context.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "No JSON array in response" }, { status: 500 });
  }

  const items: ResearchItem[] = JSON.parse(jsonMatch[0]).map(
    (item: Omit<ResearchItem, "id" | "generated_at">) => ({
      ...item,
      id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
    })
  );

  const result: ResearchData = {
    items,
    focus,
    generated_at: new Date().toISOString(),
  };

  await kv.set(RESEARCH_KEY, JSON.stringify(result));

  return NextResponse.json(result);
}
