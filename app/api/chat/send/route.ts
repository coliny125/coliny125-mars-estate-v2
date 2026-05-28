import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { threadStore } from "@/lib/storage";

const SYSTEM_PROMPT = `You are the Mars Estate Assistant — an intelligent operations co-pilot for Mars Estate, a boutique Napa Valley winery on Howell Mountain.

You help the winery owner manage:
- Communications (emails, meetings, follow-ups)
- Immediate to-dos and task management
- Research on wine industry trends, regulations, market conditions
- Harvest planning, vineyard management
- DTC sales, mailing list, and wholesale relationships
- Tasting room operations

You have access to a tool to add todos when asked. Be concise, direct, and winery-savvy. When referencing emails or meetings you don't have direct access to, acknowledge that and offer to help think through the situation.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_todo",
    description: "Add a task to the immediate to-do list",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The task description" },
        priority: {
          type: "string",
          enum: ["H", "M", "L"],
          description: "H=High/this week, M=Medium/next two weeks, L=Ongoing",
        },
      },
      required: ["text"],
    },
  },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const body = await req.json();
  const { message, threadId: existingThreadId } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  let thread = existingThreadId ? threadStore.get(existingThreadId) : null;
  if (!thread) {
    thread = threadStore.create();
  }

  threadStore.addMessage(thread.id, "user", message);

  const history = thread.messages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let fullContent = "";
        const toolCallsPending: { name: string; input: Record<string, string> }[] = [];

        const messages: Anthropic.MessageParam[] = [
          ...history,
          { role: "user", content: message },
        ];

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        });

        // Process tool use if any
        for (const block of response.content) {
          if (block.type === "tool_use") {
            toolCallsPending.push({
              name: block.name,
              input: block.input as Record<string, string>,
            });
          }
        }

        // Execute tool calls
        const toolResults: Anthropic.MessageParam[] = [];
        for (const call of toolCallsPending) {
          if (call.name === "add_todo") {
            const { text, priority = "M" } = call.input;
            await fetch(
              `${req.nextUrl.origin}/api/todos`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, priority }),
              }
            );
            send({ content: `\n✓ Added to-do: "${text}"\n` });
            fullContent += `\n✓ Added to-do: "${text}"\n`;
          }
        }

        // Get final text response
        let textResponse = "";
        if (response.stop_reason === "tool_use" && toolCallsPending.length > 0) {
          // Second call after tool use
          const followUp = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 512,
            system: SYSTEM_PROMPT,
            messages: [
              ...messages,
              { role: "assistant", content: response.content },
              ...toolResults,
            ],
          });
          for (const block of followUp.content) {
            if (block.type === "text") textResponse += block.text;
          }
        } else {
          for (const block of response.content) {
            if (block.type === "text") textResponse += block.text;
          }
        }

        // Stream text word by word for effect
        if (textResponse) {
          const words = textResponse.split(/(\s+)/);
          for (const word of words) {
            if (word) {
              send({ content: word });
              fullContent += word;
              await new Promise((r) => setTimeout(r, 15));
            }
          }
        }

        threadStore.addMessage(thread!.id, "assistant", fullContent);
        send({ done: true, threadId: thread!.id });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        send({ error: msg });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Thread-Id": thread.id,
    },
  });
}
