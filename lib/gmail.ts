import { kv } from "@vercel/kv";

const TOKEN_KEY = "gmail:tokens";

interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry: number; // epoch ms
}

export interface GmailThread {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
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

  if (Date.now() < tokens.expiry - 120_000) {
    return tokens.access_token;
  }

  // Refresh
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

export async function fetchRecentThreads(
  maxResults = 40
): Promise<GmailThread[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  // Get thread IDs from inbox
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&labelIds=INBOX&q=-category:promotions -category:updates`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const threads: { id: string }[] = listData.threads ?? [];

  // Fetch each thread (snippet + headers)
  const results: GmailThread[] = [];
  for (const { id } of threads.slice(0, 30)) {
    const threadRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const thread = await threadRes.json();
    const msg = thread.messages?.[thread.messages.length - 1];
    if (!msg) continue;

    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    results.push({
      id,
      snippet: thread.snippet ?? "",
      subject: get("Subject"),
      from: get("From"),
      date: get("Date"),
      labelIds: msg.labelIds ?? [],
    });
  }

  return results;
}
