"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Thread {
  id: string;
  title: string | null;
  last_message_at: string;
}

const SUGGESTED = [
  {
    title: "What did Lindsay say about the landing page?",
    desc: "Retrieves from email cache · inline citations",
  },
  {
    title: "Summarize the latest exchanges with Walker Warner.",
    desc: "Retrieves + synthesizes · multi-message",
  },
  {
    title: "Add to-do: review BPS quote",
    desc: "Calls add_todo tool · panel updates instantly",
  },
  {
    title: "Run fresh research on Howell Mountain pricing.",
    desc: "Triggers research agent · 30–90 seconds",
  },
];

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const t = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T")).getTime();
  if (!Number.isFinite(t)) return "";
  const n = Math.round((Date.now() - t) / 60000);
  if (n < 1) return "just now";
  if (n < 60) return `${n}m ago`;
  const h = Math.floor(n / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function loadThreads() {
    setThreadsLoading(true);
    try {
      const r = await fetch("/api/chat/threads");
      if (r.ok) {
        const d = await r.json();
        setThreads(d.threads);
      }
    } finally {
      setThreadsLoading(false);
    }
  }

  async function loadThread(id: string) {
    setCurrentThreadId(id);
    const r = await fetch(`/api/chat/threads/${id}`);
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages ?? []);
    }
  }

  async function deleteThread(id: string) {
    await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (currentThreadId === id) {
      setCurrentThreadId(null);
      setMessages([]);
    }
    setConfirmDelete(null);
  }

  async function send(text: string) {
    const msg = text || input;
    if (!msg.trim() || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    const userMsg: Message = {
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const r = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, threadId: currentThreadId }),
      });

      if (!r.ok) throw new Error(`Error ${r.status}`);

      const threadId = r.headers.get("X-Thread-Id");
      if (threadId && !currentThreadId) {
        setCurrentThreadId(threadId);
        router.replace(`/chat?thread=${threadId}`);
      }

      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  full += parsed.content;
                  setStreamingContent(full);
                }
                if (parsed.threadId && !currentThreadId) {
                  setCurrentThreadId(parsed.threadId);
                }
              } catch {}
            }
          }
        }
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: full,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
      await loadThreads();
    } catch (e) {
      const errMsg: Message = {
        role: "assistant",
        content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="h-screen flex flex-col bg-[#0e0b0a]">
      <header className="border-b hairline shrink-0">
        <div className="mx-auto max-w-7xl px-6 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="eyebrow hover:text-parchment-200 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-parchment-500/40">|</span>
            <span className="display-serif text-lg text-parchment-200">
              Mars Estate Assistant
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentThreadId(null);
              setMessages([]);
              router.replace("/chat");
            }}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            aria-label="Start a new conversation"
          >
            New chat
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-[18rem] border-r hairline flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b hairline">
            <span className="eyebrow">Conversations</span>
          </div>
          <div className="flex-1 overflow-y-auto panel-scroll">
            {threadsLoading ? (
              <p className="px-4 py-3 text-sm text-parchment-500">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-3 text-sm text-parchment-500 italic">
                No conversations yet.
              </p>
            ) : (
              <ul>
                {threads.map((t) => {
                  const active = t.id === currentThreadId;
                  return (
                    <li key={t.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => loadThread(t.id)}
                        className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
                          active
                            ? "border-brass-500 bg-ink-700/60 text-parchment-200"
                            : "border-transparent hover:bg-ink-700/40 text-parchment-400"
                        }`}
                      >
                        <div className="text-sm truncate">
                          {t.title ?? "Untitled conversation"}
                        </div>
                        <div className="text-[10px] tracking-eyebrow uppercase text-parchment-500/60 mt-0.5">
                          {relTime(t.last_message_at)}
                        </div>
                      </button>
                      {confirmDelete === t.id ? (
                        <div className="absolute right-2 top-2 flex items-center gap-1 bg-ink-800/95 border hairline rounded-sm px-2 py-1">
                          <button
                            type="button"
                            onClick={() => deleteThread(t.id)}
                            className="text-[10px] tracking-eyebrow uppercase text-oxblood-400 hover:text-oxblood-400/80"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="text-[10px] tracking-eyebrow uppercase text-parchment-500 hover:text-parchment-200 ml-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(t.id);
                          }}
                          className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 text-[10px] tracking-eyebrow uppercase text-parchment-500/50 hover:text-parchment-200 transition-opacity"
                          aria-label="Delete conversation"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto panel-scroll px-6 py-6">
            {isEmpty ? (
              <div className="max-w-2xl mx-auto">
                <h1 className="display-serif text-3xl text-parchment-200 mb-2">
                  Mars Estate Assistant
                </h1>
                <p className="text-sm text-parchment-500 mb-8">
                  Ask about emails, meetings, the vault, or take an action.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => send(s.title)}
                      className="text-left border hairline hover:border-brass-500/40 rounded-sm px-4 py-3 bg-ink-700/30 hover:bg-ink-700/60 transition-colors"
                    >
                      <div className="text-sm text-parchment-100 mb-1">
                        {s.title}
                      </div>
                      <div className="text-[10px] tracking-eyebrow uppercase text-parchment-500/70">
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-sm px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-brass-500/80 text-ink"
                          : "bg-ink-700/60 text-parchment-200 border hairline"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {streaming && streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-sm px-4 py-3 text-sm leading-relaxed bg-ink-700/60 text-parchment-200 border hairline">
                      <div className="whitespace-pre-wrap">{streamingContent}</div>
                    </div>
                  </div>
                )}
                {streaming && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 text-parchment-500 text-sm animate-pulse">
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t hairline px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 panel-surface rounded-sm px-3 py-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about Mars Estate…"
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-parchment-100 placeholder:text-parchment-500 focus:outline-none resize-none"
                  style={{ minHeight: "1.5rem", maxHeight: "8rem" }}
                />
                <button
                  type="button"
                  disabled={!input.trim() || streaming}
                  onClick={() => send(input)}
                  className="text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {streaming ? "…" : "Send"}
                </button>
              </div>
              <p className="text-[10px] tracking-eyebrow uppercase text-parchment-500/40 mt-2 text-center">
                Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
