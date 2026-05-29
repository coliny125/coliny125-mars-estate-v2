"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  active: boolean;
  durationMs: number;
}

export default function ProgressBar({ active, durationMs }: Props) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);

    if (active) {
      setVisible(true);
      setWidth(0);
      // Double rAF so the 0→85 transition fires after paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWidth(85));
      });
    } else {
      setWidth(100);
      fadeTimer.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
    }

    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div className="h-[2px] w-full bg-ink-700 overflow-hidden">
      <div
        className="h-full bg-brass-500"
        style={{
          width: `${width}%`,
          transition: active
            ? `width ${durationMs}ms cubic-bezier(0.1, 0.4, 0.3, 1)`
            : "width 300ms ease-in",
        }}
      />
    </div>
  );
}
