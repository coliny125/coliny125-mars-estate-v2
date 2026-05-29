import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { todayLong } from "@/lib/date";

export default function Header() {
  return (
    <header className="border-b hairline">
      <div className="mx-auto max-w-7xl px-8 pt-10 pb-8">
        <div className="grid grid-cols-3 items-center">
          {/* Left: wordmark */}
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Howell Mountain · Napa Valley</span>
            <span className="wordmark text-2xl text-parchment-100">
              Mars Estate
            </span>
          </div>

          {/* Center: nav */}
          <nav className="flex items-center justify-center gap-7">
            <Link
              href="/"
              className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/chat"
              className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/graph"
              className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            >
              Graph
            </Link>
            <Link
              href="/wiki"
              className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            >
              Wiki
            </Link>
            <Link
              href="/settings"
              className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            >
              Settings
            </Link>
          </nav>

          {/* Right: date + avatar */}
          <div className="flex items-center justify-end gap-5">
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="eyebrow">Operations</span>
              <span className="display-serif text-lg text-parchment-300">
                {todayLong()}
              </span>
            </div>
            <UserButton
              appearance={{
                variables: {
                  colorPrimary: "rgb(176 141 87)",
                  colorBackground: "rgb(21 17 15)",
                  colorText: "rgb(244 238 226)",
                  borderRadius: "2px",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
