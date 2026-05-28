import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface ResearchItem {
  id: string;
  topic: string;
  summary: string;
  bullets?: string[];
  source?: string;
  generated_at: string;
}

let cachedResearch: {
  items: ResearchItem[];
  focus: string[];
  generated_at: string | null;
} = {
  items: [],
  focus: [
    "Howell Mountain AVA pricing trends",
    "Napa Valley harvest outlook",
    "DTC wine sales and direct-to-consumer regulations",
  ],
  generated_at: null,
};

export async function GET() {
  return NextResponse.json(cachedResearch);
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  if (cachedResearch.focus.length === 0) {
    return NextResponse.json({ error: "No focus topics configured" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a research assistant for Mars Estate, a premium Napa Valley winery on Howell Mountain.

Research the following topics and provide actionable intelligence relevant to a boutique winery operation:
${cachedResearch.focus.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return a JSON array of research items:
[
  {
    "topic": "<topic name>",
    "summary": "<2-3 sentence synthesis with specific, current, winery-relevant insights>",
    "bullets": ["<specific data point or action>", "<specific data point or action>"],
    "source": "Industry analysis"
  }
]

Be specific, actionable, and grounded in real winery/wine industry context. Reference realistic trends, regulations, and market conditions.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const items: ResearchItem[] = JSON.parse(jsonMatch[0]).map(
      (item: Omit<ResearchItem, "id" | "generated_at">) => ({
        ...item,
        id: crypto.randomUUID(),
        generated_at: new Date().toISOString(),
      })
    );

    cachedResearch = {
      items,
      focus: cachedResearch.focus,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(cachedResearch);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
