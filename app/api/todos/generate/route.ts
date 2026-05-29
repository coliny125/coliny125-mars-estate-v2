import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { todoStore } from "@/lib/storage";
import { getUserId } from "@/lib/auth-util";
import { briefingKey } from "@/lib/sync";
import type { Priority } from "@/lib/storage";
import type { StoredBriefing } from "@/lib/sync";

export const maxDuration = 30;

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const { userId } = auth;

  const [briefingRaw, existingTodos] = await Promise.all([
    kv.get<StoredBriefing>(briefingKey(userId)),
    todoStore.list(userId),
  ]);

  if (!briefingRaw || !briefingRaw.items?.length) {
    return NextResponse.json(
      { error: "No briefing found — reload Communications first" },
      { status: 400 }
    );
  }

  const briefingItems = briefingRaw.items
    .map((i) => `[${i.kind.toUpperCase()}] ${i.body}`)
    .join("\n");

  const openTodos = existingTodos
    .filter((t) => !t.done)
    .map((t) => `[${t.priority}] ${t.text}`)
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `You are extracting concrete action items from a Mars Estate inbox briefing.

## Briefing items
${briefingItems}

## Already open todos (do not duplicate these)
${openTodos || "None"}

Extract 3–5 specific, actionable to-dos from the briefing that are NOT already covered by the open todos above. Each must be a single clear task someone can complete.

Assign priority:
- H: needs to happen this week, has a deadline, or blocks something
- M: important but can wait 1–2 weeks
- L: ongoing or monitor

Return ONLY a JSON array:
[
  {"text": "<specific task>", "priority": "H|M|L"},
  ...
]`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return NextResponse.json({ error: "Could not parse Claude response" }, { status: 500 });
  }

  const suggestions: { text: string; priority: string }[] = JSON.parse(match[0]);

  const added = await Promise.all(
    suggestions
      .filter((s) => s.text?.trim())
      .map((s) =>
        todoStore.add(userId, s.text.trim(), (s.priority as Priority) ?? "M")
      )
  );

  return NextResponse.json({ todos: added });
}
