// In-memory store for todos and chat threads (replace with DB in production)
// For Vercel deployment, this resets on cold start — use KV or Postgres for persistence.

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

// Simple in-memory stores — survive the process lifetime
const todos: Map<string, Todo> = new Map();
const threads: Map<string, ChatThread> = new Map();

export const todoStore = {
  list(): Todo[] {
    return Array.from(todos.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  add(text: string, priority: Priority): Todo {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      priority,
      done: false,
      created_at: new Date().toISOString(),
    };
    todos.set(todo.id, todo);
    return todo;
  },
  update(id: string, patch: Partial<Todo>): Todo | null {
    const t = todos.get(id);
    if (!t) return null;
    const updated = { ...t, ...patch };
    todos.set(id, updated);
    return updated;
  },
  delete(id: string): boolean {
    return todos.delete(id);
  },
};

export const threadStore = {
  list(): Omit<ChatThread, "messages">[] {
    return Array.from(threads.values())
      .sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      )
      .map(({ id, title, last_message_at }) => ({ id, title, last_message_at }));
  },
  get(id: string): ChatThread | null {
    return threads.get(id) ?? null;
  },
  create(): ChatThread {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: null,
      messages: [],
      last_message_at: new Date().toISOString(),
    };
    threads.set(thread.id, thread);
    return thread;
  },
  addMessage(
    threadId: string,
    role: "user" | "assistant",
    content: string
  ): ChatThread | null {
    const thread = threads.get(threadId);
    if (!thread) return null;
    thread.messages.push({ role, content, created_at: new Date().toISOString() });
    thread.last_message_at = new Date().toISOString();
    if (!thread.title && role === "user") {
      thread.title = content.slice(0, 60);
    }
    return thread;
  },
  delete(id: string): boolean {
    return threads.delete(id);
  },
};
