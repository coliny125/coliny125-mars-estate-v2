// Storage backed by Vercel KV (Redis) when env vars are present,
// falling back to in-memory for local dev without KV configured.

import { kv } from "@vercel/kv";

export type Priority = "H" | "M" | "L";

export interface Todo {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatThread {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  last_message_at: string;
}

const KV_TODOS_KEY = "todos";
const KV_THREADS_INDEX = "threads:index";
const kvAvailable = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

// --- In-memory fallback ---
const memTodos = new Map<string, Todo>();
const memThreads = new Map<string, ChatThread>();

// --- Todos ---
export const todoStore = {
  async list(): Promise<Todo[]> {
    if (kvAvailable) {
      const todos = await kv.hgetall<Record<string, Todo>>(KV_TODOS_KEY);
      if (!todos) return [];
      return Object.values(todos).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return Array.from(memTodos.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async add(text: string, priority: Priority): Promise<Todo> {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      priority,
      done: false,
      created_at: new Date().toISOString(),
    };
    if (kvAvailable) {
      await kv.hset(KV_TODOS_KEY, { [todo.id]: todo });
    } else {
      memTodos.set(todo.id, todo);
    }
    return todo;
  },

  async update(id: string, patch: Partial<Todo>): Promise<Todo | null> {
    if (kvAvailable) {
      const existing = await kv.hget<Todo>(KV_TODOS_KEY, id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      await kv.hset(KV_TODOS_KEY, { [id]: updated });
      return updated;
    }
    const t = memTodos.get(id);
    if (!t) return null;
    const updated = { ...t, ...patch };
    memTodos.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    if (kvAvailable) {
      const n = await kv.hdel(KV_TODOS_KEY, id);
      return n > 0;
    }
    return memTodos.delete(id);
  },
};

// --- Chat threads ---
export const threadStore = {
  async list(): Promise<Omit<ChatThread, "messages">[]> {
    if (kvAvailable) {
      const ids = await kv.smembers<string[]>(KV_THREADS_INDEX);
      if (!ids || ids.length === 0) return [];
      const threads = await Promise.all(
        ids.map((id) => kv.get<ChatThread>(`thread:${id}`))
      );
      return threads
        .filter((t): t is ChatThread => t !== null)
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
        )
        .map(({ id, title, last_message_at }) => ({
          id,
          title,
          last_message_at,
        }));
    }
    return Array.from(memThreads.values())
      .sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      )
      .map(({ id, title, last_message_at }) => ({ id, title, last_message_at }));
  },

  async get(id: string): Promise<ChatThread | null> {
    if (kvAvailable) {
      return kv.get<ChatThread>(`thread:${id}`);
    }
    return memThreads.get(id) ?? null;
  },

  async create(): Promise<ChatThread> {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: null,
      messages: [],
      last_message_at: new Date().toISOString(),
    };
    if (kvAvailable) {
      await kv.set(`thread:${thread.id}`, thread);
      await kv.sadd(KV_THREADS_INDEX, thread.id);
    } else {
      memThreads.set(thread.id, thread);
    }
    return thread;
  },

  async addMessage(
    threadId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatThread | null> {
    const thread = await this.get(threadId);
    if (!thread) return null;
    thread.messages.push({
      role,
      content,
      created_at: new Date().toISOString(),
    });
    thread.last_message_at = new Date().toISOString();
    if (!thread.title && role === "user") {
      thread.title = content.slice(0, 60);
    }
    if (kvAvailable) {
      await kv.set(`thread:${threadId}`, thread);
    } else {
      memThreads.set(threadId, thread);
    }
    return thread;
  },

  async delete(id: string): Promise<boolean> {
    if (kvAvailable) {
      const n = await kv.del(`thread:${id}`);
      await kv.srem(KV_THREADS_INDEX, id);
      return n > 0;
    }
    return memThreads.delete(id);
  },
};
