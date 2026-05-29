import { kv } from "@vercel/kv";

const TOKEN_KEY = "gmail:tokens";
const BODY_MAX_CHARS = 2500;

interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry: number;
}

export interface GmailThread {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  labelIds: string[];
}

export async function isGmailConnected(): Promise<boolean> {
  const tokens = await kv.get<GmailTokens>(TOKEN_KEY);
  return !!tokens?.refresh_token;
}

export async function storeTokens(
  access_token: string,
  refresh_token: string,
  expires_in: number
) {
  await kv.set<GmailTokens>(TOKEN_KEY, {
    access_token,
    refresh_token,
    expiry: Date.now() + expires_in * 1000,
  });
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = await kv.get<GmailTokens>(TOKEN_KEY);
  if (!tokens?.refresh_token) return null;

  if (Date.now() < tokens.expiry - 120_000) return tokens.access_token;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await r.json();
  if (!data.access_token) return null;

  await kv.set<GmailTokens>(TOKEN_KEY, {
    ...tokens,
    access_token: data.access_token,
    expiry: Date.now() + (data.expires_in ?? 3600) * 1000,
  });

  return data.access_token;
}

// Recursively extract plain-text content from a Gmail message payload
function extractPlainText(payload: Record<string, unknown>): string {
  const mimeType = payload.mimeType as string ?? "";

  if (mimeType === "text/plain") {
    const data = (payload.body as Record<string, string>)?.data ?? "";
    if (!data) return "";
    // Gmail uses base64url encoding
    const decoded = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    return decoded;
  }

  // For multipart, prefer text/plain over text/html
  const parts = (payload.parts as Record<string, unknown>[]) ?? [];
  const plainPart = parts.find((p) => (p.mimeType as string) === "text/plain");
  if (plainPart) return extractPlainText(plainPart);

  // Recurse into any part
  for (const part of parts) {
    const text = extractPlainText(part);
    if (text) return text;
  }

  return "";
}

async function fetchThreadFull(
  id: string,
  token: string
): Promise<GmailThread | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const thread = await res.json();

  // Use the most recent message for headers; concatenate all message bodies
  const messages: Record<string, unknown>[] = thread.messages ?? [];
  if (!messages.length) return null;

  const lastMsg = messages[messages.length - 1] as Record<string, unknown>;
  const headers: { name: string; value: string }[] =
    (lastMsg.payload as Record<string, unknown>)?.headers as { name: string; value: string }[] ?? [];

  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  // Combine bodies from all messages in the thread (newest first, truncated)
  let combinedBody = messages
    .slice()
    .reverse()
    .map((m) => {
      const payload = (m as Record<string, unknown>).payload as Record<string, unknown>;
      return payload ? extractPlainText(payload) : "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  // Strip quoted reply chains (lines starting with ">") to reduce noise
  combinedBody = combinedBody
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (combinedBody.length > BODY_MAX_CHARS) {
    combinedBody = combinedBody.slice(0, BODY_MAX_CHARS) + "…";
  }

  return {
    id,
    snippet: thread.snippet ?? "",
    subject: get("Subject"),
    from: get("From"),
    date: get("Date"),
    body: combinedBody || get("Subject"), // fallback to subject if body is empty
    labelIds: (lastMsg.labelIds as string[]) ?? [],
  };
}

export async function fetchRecentThreads(
  maxResults = 40
): Promise<GmailThread[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&labelIds=INBOX&q=-category:promotions -category:updates`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const threadIds: string[] = (listData.threads ?? [])
    .slice(0, 30)
    .map((t: { id: string }) => t.id);

  // Fetch all threads in parallel
  const settled = await Promise.allSettled(
    threadIds.map((id) => fetchThreadFull(id, token))
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<GmailThread> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
