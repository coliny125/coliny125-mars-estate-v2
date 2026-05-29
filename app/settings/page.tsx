"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";

export default function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(d.connected))
      .catch(() => setGmailConnected(false));
  }, []);

  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8">
          <div className="eyebrow mb-1">Configuration</div>
          <h1 className="display-serif text-3xl text-parchment-100">Settings</h1>
        </div>

        <div className="max-w-xl space-y-6">
          {/* Gmail */}
          <section className="panel-surface rounded-sm shadow-panel px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-1">Data Source</div>
                <h2 className="display-serif text-xl text-parchment-100">Gmail</h2>
                <p className="text-sm text-parchment-500 mt-1 leading-snug">
                  Powers the Communications briefing. Reads inbox threads via
                  read-only OAuth — no write access.
                </p>
              </div>
              <div className="shrink-0 pt-1">
                {gmailConnected === null && (
                  <span className="text-xs text-parchment-500">Checking…</span>
                )}
                {gmailConnected === false && (
                  <a
                    href="/api/auth/gmail"
                    className="inline-block text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 transition-colors"
                  >
                    Connect Gmail
                  </a>
                )}
                {gmailConnected === true && (
                  <span className="text-[11px] tracking-eyebrow uppercase text-brass-500">
                    Connected ✓
                  </span>
                )}
              </div>
            </div>
            {gmailConnected === false && (
              <p className="mt-3 text-xs text-parchment-500/70 leading-relaxed border-t hairline pt-3">
                Make sure <span className="text-parchment-300">colinyuan@marscap.investments</span> is
                added as a test user in Google Cloud Console → OAuth consent screen → Test users,
                since the app is still in Testing mode.
              </p>
            )}
          </section>

          {/* Chat */}
          <section className="panel-surface rounded-sm shadow-panel px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-1">Interface</div>
                <h2 className="display-serif text-xl text-parchment-100">Full Chat</h2>
                <p className="text-sm text-parchment-500 mt-1 leading-snug">
                  Full-screen chat with thread history, streaming responses, and
                  knowledge base access.
                </p>
              </div>
              <div className="shrink-0 pt-1">
                <a
                  href="/chat"
                  className="inline-block text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 transition-colors"
                >
                  Open Chat →
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
