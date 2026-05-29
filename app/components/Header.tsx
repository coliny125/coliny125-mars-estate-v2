import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { todayLong } from "@/lib/date";

export default function Header() {
  return (
    <header className="border-b hairline">
      <div className="mx-auto max-w-7xl px-8 pt-10 pb-8">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Howell Mountain · Napa Valley</span>
            <span className="wordmark text-2xl text-parchment-100">
              Mars Estate
            </span>
          </div>
          <div className="flex items-start gap-6">
            <nav className="flex items-center gap-5 pt-1">
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
                href="/settings"
                className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
              >
                Settings
              </Link>
            </nav>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="eyebrow">Operations</span>
              <span className="display-serif text-lg text-parchment-300">
                {todayLong()}
              </span>
            </div>
            <div className="pt-1">
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
      </div>
    </header>
  );
}
