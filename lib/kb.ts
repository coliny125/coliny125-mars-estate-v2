import { kv } from "@vercel/kv";

export interface KBIndexEntry {
  slug: string;
  title: string;
  section: string;
  updated: string;
}

export interface KBDoc {
  slug: string;
  title: string;
  section: string;
  updated: string;
  content: string;
}

export async function getKBIndex(): Promise<KBIndexEntry[]> {
  try {
    const raw = await kv.get<string>("kb:index");
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : (raw as KBIndexEntry[]);
  } catch {
    return [];
  }
}

export async function getKBDoc(slug: string): Promise<KBDoc | null> {
  try {
    const raw = await kv.get<string>(`kb:doc:${slug}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : (raw as KBDoc);
  } catch {
    return null;
  }
}
