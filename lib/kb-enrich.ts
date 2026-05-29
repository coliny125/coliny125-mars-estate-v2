import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";

export async function enrichKBFromSync(
  userId: string,
  userEmail: string,
  emailContext: string
): Promise<void> {
  if (!emailContext.trim()) return;

  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are extracting structured knowledge from a Mars Estate email sync to update the shared knowledge base.

## Email threads
${emailContext}

## Extract the following (only if clearly present in the emails — do not invent):

1. NEW CONTACTS: People mentioned with enough detail to be useful (name, role/company, email if visible). Skip if already obvious from context.
2. KEY DECISIONS: Concrete decisions confirmed in these threads (vendor selected, date set, agreement reached, option rejected).
3. PROJECT UPDATES: Status changes on named Mars Estate projects (website, bottling, membership, construction, distribution, compliance, etc.).

Return ONLY a valid JSON object:
{
  "contacts": [
    {"name": "...", "role": "...", "email": "...", "context": "one sentence on how they're connected to Mars Estate"}
  ],
  "decisions": [
    {"decision": "...", "context": "..."}
  ],
  "project_updates": [
    {"project": "...", "update": "..."}
  ]
}

If a category has nothing worth adding, return an empty array for it.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return;

  let extracted: {
    contacts?: { name: string; role: string; email: string; context: string }[];
    decisions?: { decision: string; context: string }[];
    project_updates?: { project: string; update: string }[];
  };

  try {
    extracted = JSON.parse(match[0]);
  } catch {
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const slug = `inbox-intel/${userId.slice(0, 8)}/${date}`;

  const sections: string[] = [
    `---\ntitle: Inbox Intelligence — ${date}\nsection: Inbox Intel\nupdated: ${date}\nsource_user: ${userEmail}\n---`,
    `# Inbox Intelligence — ${date}\n\n*Extracted from ${userEmail}'s inbox sync*`,
  ];

  const contacts = extracted.contacts ?? [];
  const decisions = extracted.decisions ?? [];
  const updates = extracted.project_updates ?? [];

  if (contacts.length > 0) {
    sections.push(
      `## New Contacts\n\n` +
        contacts
          .map(
            (c) =>
              `| **${c.name}** | ${c.role} | ${c.email || "—"} |\n> ${c.context}`
          )
          .join("\n\n")
    );
  }

  if (decisions.length > 0) {
    sections.push(
      `## Key Decisions\n\n` +
        decisions.map((d) => `- **${d.decision}** — ${d.context}`).join("\n")
    );
  }

  if (updates.length > 0) {
    sections.push(
      `## Project Updates\n\n` +
        updates.map((u) => `- **${u.project}:** ${u.update}`).join("\n")
    );
  }

  if (contacts.length === 0 && decisions.length === 0 && updates.length === 0) {
    return; // nothing worth writing
  }

  const doc = {
    slug,
    title: `Inbox Intelligence — ${date}`,
    section: "Inbox Intel",
    updated: date,
    content: sections.join("\n\n"),
  };

  await kv.set(`kb:doc:${slug}`, JSON.stringify(doc));

  // Update the KB index
  const indexRaw = await kv.get<string>("kb:index");
  const index: { slug: string; title: string; section: string; updated: string }[] =
    indexRaw
      ? typeof indexRaw === "string"
        ? JSON.parse(indexRaw)
        : (indexRaw as typeof index)
      : [];

  const existing = index.findIndex((e) => e.slug === slug);
  const entry = { slug, title: doc.title, section: doc.section, updated: date };
  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
  await kv.set("kb:index", JSON.stringify(index));
}
