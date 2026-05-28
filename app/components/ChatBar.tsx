"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChatBar() {
  const [input, setInput] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = encodeURIComponent(input.trim());
    router.push(`/chat?q=${q}`);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-7xl px-8 pb-4 pointer-events-auto">
        <form
          onSubmit={handleSubmit}
          className="rounded-sm panel-surface px-3 py-2 flex items-center gap-2 shadow-panel"
        >
          <Link
            href="/chat"
            className="text-[10px] tracking-eyebrow uppercase text-parchment-500 hover:text-parchment-200 transition-colors px-2 py-1.5"
          >
            History
          </Link>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about Mars Estate — emails, meetings, vault, or take an action…"
            className="flex-1 bg-transparent text-sm text-parchment-100 placeholder:text-parchment-500 px-2 py-1.5 focus:outline-none"
          />
          <Link
            href="/chat"
            className="text-[10px] tracking-eyebrow uppercase text-parchment-500 hover:text-parchment-200 transition-colors px-2 py-1.5 hidden sm:inline-block"
            title="Open the full chat view"
          >
            Open
          </Link>
          <button
            type="submit"
            disabled={!input.trim()}
            className="text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
