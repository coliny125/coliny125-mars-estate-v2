import { todayLong } from "@/lib/date";
import CommunicationsPanel from "./components/CommunicationsPanel";
import TodosPanel from "./components/TodosPanel";
import ResearchPanel from "./components/ResearchPanel";
import GrowthMetricsPanel from "./components/GrowthMetricsPanel";
import SystemHealthFooter from "./components/SystemHealthFooter";
import ChatBar from "./components/ChatBar";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b hairline">
        <div className="mx-auto max-w-7xl px-8 pt-10 pb-8">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col gap-1">
              <span className="eyebrow">Howell Mountain · Napa Valley</span>
              <span className="wordmark text-2xl text-parchment-100">
                Mars Estate
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="eyebrow">Operations</span>
              <span className="display-serif text-lg text-parchment-300">
                {todayLong()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10 pb-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CommunicationsPanel />
          <TodosPanel />
          <ResearchPanel />
          <GrowthMetricsPanel />
        </div>

        <div className="mt-12 pt-6 border-t hairline">
          <SystemHealthFooter />
        </div>

        <footer className="mt-6 pt-6 border-t hairline flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Mars Estate Operations · v2b</span>
            <span className="text-xs text-parchment-500">
              Cloud-ready · deployed on Vercel
            </span>
          </div>
          <div className="display-serif text-parchment-500 italic text-sm">
            Access by Allocation Only
          </div>
        </footer>
      </div>

      <ChatBar />
    </main>
  );
}
