"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  streak: number;
  onOpenAppearance: () => void;
};

/**
 * Visible at the top, hides on scroll down, returns on a slight scroll up.
 * Nothing else belongs up here.
 */
export function Header({ streak, onOpenAppearance }: Props) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y < 40) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -4) setHidden(false);
        lastY.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 transition-transform duration-300"
      style={{
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        paddingTop: "env(safe-area-inset-top)",
        background: "var(--page)",
      }}
    >
      <div className="page-pad measure flex items-center justify-between py-2">
        <span className="tap flex items-center text-[15px]" aria-label={`Streak ${streak}`}>
          {streak > 0 ? streak : ""}
        </span>
        <button
          type="button"
          onClick={onOpenAppearance}
          className="tap flex items-center justify-end text-[17px]"
          aria-label="Appearance"
        >
          Aa
        </button>
      </div>
    </header>
  );
}
