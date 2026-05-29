import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { getKBDoc } from "@/lib/kb";

export const RESEARCH_KEY = "research:latest";
export const FOCUS_KEY = "research:focus";

const STRATEGY_SLUGS = [
  "strategy/key-strategic-decisions",
  "strategy/competitive-positioning",
  "sales-distribution/membership-program",
  "winemaking-viticulture/terroir-science-projects",
  "strategy/milestones-timeline",
];

export interface ResearchItem {
  id: string;
  topic: string;
  summary: string;
  bullets?: string[];
  source?: string;
  generated_at: string;
}

export interface ResearchData {
  items: ResearchItem[];
  focus: string[];
  generated_at: string | null;
}

export async function isResearchStale(maxAgeHours = 20): Promise<boolean> {
  const raw = await kv.get<string>(RESEARCH_KEY);
  if (!raw) return true;
  const data: ResearchData =
    typeof raw === "string" ? JSON.parse(raw) : (raw as ResearchData);
  if (!data.generated_at) return true;
  const ageHours =
    (Date.now() - new Date(data.generated_at).getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

export async function autoRunResearch(): Promise<ResearchData> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  // Load strategy docs for context
  const docs = await Promise.all(STRATEGY_SLUGS.map((s) => getKBDoc(s)));
  const context = docs
    .filter(Boolean)
    .map((d) => `## ${d!.title}\n${d!.content}`)
    .join("\n\n---\n\n");

  // Derive research topics from current strategic priorities
  const topicsResp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Based on these Mars Estate strategic documents, identify exactly 6 specific research topics the team should be monitoring right now. Topics should be timely, directly tied to the decisions and projects currently in motion, and actionable.

${context}

Return ONLY a JSON array of 6 strings, no other text:
["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6"]`,
      },
    ],
  });

  const topicsText =
    topicsResp.content[0].type === "text" ? topicsResp.content[0].text : "[]";
  const topicsMatch = topicsText.match(/\[[\s\S]*?\]/);
  const topics: string[] = topicsMatch ? JSON.parse(topicsMatch[0]) : [];

  if (topics.length === 0) {
    throw new Error("Could not derive research topics from KB");
  }

  await kv.set(FOCUS_KEY, JSON.stringify(topics));

  // Run research on the derived topics
  const researchResp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a research assistant for Mars Estate, a premium Napa Valley winery on Howell Mountain. Research these topics and provide actionable intelligence relevant to a boutique winery:

${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return a JSON array:
[
  {
    "topic": "<topic name>",
    "summary": "<2-3 sentence synthesis with specific, current, winery-relevant insights>",
    "bullets": ["<data point or action>", "<data point or action>"],
    "source": "Industry analysis"
  }
]`,
      },
    ],
  });

  const researchText =
    researchResp.content[0].type === "text" ? researchResp.content[0].text : "";
  const researchMatch = researchText.match(/\[[\s\S]*\]/);
  if (!researchMatch) throw new Error("No JSON in research response");

  const items: ResearchItem[] = JSON.parse(researchMatch[0]).map(
    (item: Omit<ResearchItem, "id" | "generated_at">) => ({
      ...item,
      id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
    })
  );

  const result: ResearchData = {
    items,
    focus: topics,
    generated_at: new Date().toISOString(),
  };

  await kv.set(RESEARCH_KEY, JSON.stringify(result));
  return result;
}
