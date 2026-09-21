"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_SIZE,
  SIZES,
  getAppearance,
  getHighlightColor,
  getSize,
  setAppearance,
  setHighlightColor,
  setSize,
  type Appearance,
  type HighlightColor,
} from "@/lib/client/prefs";

type Props = {
  open: boolean;
  onClose: () => void;
  onColorChange: (color: HighlightColor) => void;
};

/** Holds appearance and highlight colour. Nothing else. */
export function AaPopover({ open, onClose, onColorChange }: Props) {
  const [appearance, setAppearanceState] = useState<Appearance>("auto");
  const [color, setColorState] = useState<HighlightColor>("yellow");
  const [size, setSizeState] = useState<number>(DEFAULT_SIZE);

  useEffect(() => {
    if (!open) return;
    setAppearanceState(getAppearance());
    setColorState(getHighlightColor());
    setSizeState(getSize());
  }, [open]);

  if (!open) return null;

  const choose = (next: Appearance) => {
    setAppearance(next);
    setAppearanceState(next);
  };

  const chooseColor = (next: HighlightColor) => {
    setHighlightColor(next);
    setColorState(next);
    onColorChange(next);
  };

  const chooseSize = (next: number) => {
    setSize(next);
    setSizeState(next);
  };

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="surface animate-fade-quick absolute right-4 rounded-2xl p-4"
        style={{ top: "calc(env(safe-area-inset-top) + 52px)", minWidth: "17rem" }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Appearance"
      >
        <div className="flex gap-2">
          {(["light", "dark", "auto"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className="tap flex-1 rounded-xl px-2 text-[15px] capitalize"
              style={{
                background: appearance === option ? "var(--hl-yellow)" : "transparent",
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseSize(option)}
              className="tap flex-1 rounded-xl"
              style={{
                fontSize: `${Math.round(option * 0.8)}px`,
                background: size === option ? "var(--hl-yellow)" : "transparent",
              }}
              aria-label={`Text size ${option}`}
            >
              Aa
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          {(["yellow", "blue"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseColor(option)}
              className="tap flex-1 rounded-xl"
              aria-label={`Highlight ${option}`}
              style={{
                background: option === "yellow" ? "var(--hl-yellow)" : "var(--hl-blue)",
                outline: color === option ? "2px solid var(--ink)" : "none",
                outlineOffset: "-2px",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
