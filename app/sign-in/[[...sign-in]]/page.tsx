import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0b0a]">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="eyebrow mb-2">Howell Mountain · Napa Valley</p>
          <h1 className="display-serif text-3xl text-parchment-100">
            Mars Estate
          </h1>
          <p className="text-parchment-500 text-sm mt-1 italic">
            Access by Allocation Only
          </p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "rgb(176 141 87)",
              colorBackground: "rgb(21 17 15)",
              colorInputBackground: "rgb(28 23 20)",
              colorText: "rgb(244 238 226)",
              colorTextSecondary: "rgb(138 125 99)",
              colorInputText: "rgb(244 238 226)",
              borderRadius: "2px",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            },
            elements: {
              card: "bg-ink-800 border border-parchment-200/10 shadow-panel",
              formButtonPrimary:
                "bg-brass-500 hover:bg-brass-400 text-ink font-medium tracking-eyebrow uppercase text-xs",
            },
          }}
        />
      </div>
    </div>
  );
}
