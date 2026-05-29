import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { threadStore, todoStore } from "@/lib/storage";
import { getKBIndex, getKBDoc } from "@/lib/kb";
import type { Priority } from "@/lib/storage";
import type { KBIndexEntry } from "@/lib/kb";

function buildSystemPrompt(kbIndex: KBIndexEntry[]): string {
  const sections: Record<string, string[]> = {};
  for (const entry of kbIndex) {
    const s = entry.section || "General";
    if (!sections[s]) sections[s] = [];
    sections[s].push(`  • ${entry.slug} — ${entry.title}`);
  }

  const kbDir = Object.entries(sections)
    .map(([section, entries]) => `${section}:\n${entries.join("\n")}`)
    .join("\n\n");

  return `You are the Mars Estate Assistant — an intelligent operations co-pilot for Mars Estate, a boutique Napa Valley winery on Howell Mountain.

You have access to a structured knowledge base about Mars Estate. Use the get_kb_doc tool to retrieve specific documents when you need accurate details to answer a question. Always look up before guessing.

## Knowledge Base Directory
${kbDir}

## Your Capabilities
- Answer questions about Mars Estate's operations, strategy, people, and status
- Manage to-dos (add tasks via add_todo)
- Look up contacts, vendors, partners, contracts, and internal documents
- Provide context-aware guidance on winery operations

Be concise and direct. Use get_kb_doc whenever the question touches information that may be in the knowledge base.`;
}

const BASE_TOOLS: Anthropic.Tool[] = [
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
  {
    name: "get_kb_doc",
    description:
      "Retrieve a document from the Mars Estate knowledge base by its slug. Check the Knowledge Base Directory in your system prompt for available slugs.",
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description:
            "The document slug, e.g. 'strategy/company-overview' or 'contacts/core-team'",
        },
      },
      required: ["slug"],
    },
  },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
      status: 500,
    });
  }

  const body = await req.json();
  const { message, threadId: existingThreadId } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
    });
  }

  let thread = existingThreadId ? await threadStore.get(existingThreadId) : null;
  if (!thread) thread = await threadStore.create();

  await threadStore.addMessage(thread.id, "user", message);

  const fullThread = await threadStore.get(thread.id);
  const history = (fullThread?.messages ?? []).slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const kbIndex = await getKBIndex();
  const systemPrompt = buildSystemPrompt(kbIndex);

  const client = new Anthropic({ apiKey });
  const threadId = thread.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let fullContent = "";
        const messages: Anthropic.MessageParam[] = [
          ...history,
          { role: "user", content: message },
        ];

        // Agentic loop — handles chained tool calls (e.g. multiple get_kb_doc)
        let iterations = 0;
        while (iterations++ < 6) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: systemPrompt,
            tools: BASE_TOOLS,
            messages,
          });

          if (response.stop_reason !== "tool_use") {
            // Final text response — stream it
            for (const block of response.content) {
              if (block.type === "text") {
                for (const word of block.text.split(/(\s+)/)) {
                  if (word) {
                    send({ content: word });
                    fullContent += word;
                    await new Promise((r) => setTimeout(r, 15));
                  }
                }
              }
            }
            break;
          }

          // Execute tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type !== "tool_use") continue;
            const input = block.input as Record<string, string>;

            if (block.name === "add_todo") {
              const { text, priority = "M" } = input;
              await todoStore.add(text, priority as Priority);
              const msg = `Added to-do: "${text}"`;
              send({ content: `\n✓ ${msg}\n` });
              fullContent += `\n✓ ${msg}\n`;
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: msg });
            } else if (block.name === "get_kb_doc") {
              const doc = await getKBDoc(input.slug);
              const result = doc
                ? `# ${doc.title}\n\n${doc.content}`
                : `No document found for slug: ${input.slug}`;
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }
          }

          messages.push(
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults }
          );
        }

        await threadStore.addMessage(threadId, "assistant", fullContent);
        send({ done: true, threadId });
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
      "X-Thread-Id": threadId,
    },
  });
}
