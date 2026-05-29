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

const kvAvailable = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

// In-memory fallbacks (local dev without KV)
const memTodos = new Map<string, Map<string, Todo>>();
const memThreads = new Map<string, ChatThread>();

function todosKey(userId: string) { return `todos:${userId}`; }
function threadsIndexKey(userId: string) { return `threads:index:${userId}`; }
function threadKey(userId: string, threadId: string) { return `thread:${userId}:${threadId}`; }

function getUserMemTodos(userId: string): Map<string, Todo> {
  if (!memTodos.has(userId)) memTodos.set(userId, new Map());
  return memTodos.get(userId)!;
}

// --- Todos ---
export const todoStore = {
  async list(userId: string): Promise<Todo[]> {
    if (kvAvailable) {
      const todos = await kv.hgetall<Record<string, Todo>>(todosKey(userId));
      if (!todos) return [];
      return Object.values(todos).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return Array.from(getUserMemTodos(userId).values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async add(userId: string, text: string, priority: Priority): Promise<Todo> {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      priority,
      done: false,
      created_at: new Date().toISOString(),
    };
    if (kvAvailable) {
      await kv.hset(todosKey(userId), { [todo.id]: todo });
    } else {
      getUserMemTodos(userId).set(todo.id, todo);
    }
    return todo;
  },

  async update(userId: string, id: string, patch: Partial<Todo>): Promise<Todo | null> {
    if (kvAvailable) {
      const existing = await kv.hget<Todo>(todosKey(userId), id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      await kv.hset(todosKey(userId), { [id]: updated });
      return updated;
    }
    const store = getUserMemTodos(userId);
    const t = store.get(id);
    if (!t) return null;
    const updated = { ...t, ...patch };
    store.set(id, updated);
    return updated;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    if (kvAvailable) {
      const n = await kv.hdel(todosKey(userId), id);
      return n > 0;
    }
    return getUserMemTodos(userId).delete(id);
  },
};

// --- Chat threads ---
export const threadStore = {
  async list(userId: string): Promise<Omit<ChatThread, "messages">[]> {
    if (kvAvailable) {
      const ids = await kv.smembers<string[]>(threadsIndexKey(userId));
      if (!ids || ids.length === 0) return [];
      const threads = await Promise.all(
        ids.map((id) => kv.get<ChatThread>(threadKey(userId, id)))
      );
      return threads
        .filter((t): t is ChatThread => t !== null)
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
        )
        .map(({ id, title, last_message_at }) => ({ id, title, last_message_at }));
    }
    return Array.from(memThreads.values())
      .sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      )
      .map(({ id, title, last_message_at }) => ({ id, title, last_message_at }));
  },

  async get(userId: string, id: string): Promise<ChatThread | null> {
    if (kvAvailable) return kv.get<ChatThread>(threadKey(userId, id));
    return memThreads.get(id) ?? null;
  },

  async create(userId: string): Promise<ChatThread> {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: null,
      messages: [],
      last_message_at: new Date().toISOString(),
    };
    if (kvAvailable) {
      await kv.set(threadKey(userId, thread.id), thread);
      await kv.sadd(threadsIndexKey(userId), thread.id);
    } else {
      memThreads.set(thread.id, thread);
    }
    return thread;
  },

  async addMessage(
    userId: string,
    threadId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatThread | null> {
    const thread = await this.get(userId, threadId);
    if (!thread) return null;
    thread.messages.push({ role, content, created_at: new Date().toISOString() });
    thread.last_message_at = new Date().toISOString();
    if (!thread.title && role === "user") thread.title = content.slice(0, 60);
    if (kvAvailable) {
      await kv.set(threadKey(userId, threadId), thread);
    } else {
      memThreads.set(threadId, thread);
    }
    return thread;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    if (kvAvailable) {
      const n = await kv.del(threadKey(userId, id));
      await kv.srem(threadsIndexKey(userId), id);
      return n > 0;
    }
    return memThreads.delete(id);
  },
};
