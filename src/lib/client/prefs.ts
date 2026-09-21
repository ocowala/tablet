"use client";

export type Appearance = "light" | "dark" | "auto";
export type HighlightColor = "yellow" | "blue";

const THEME_KEY = "tablet.theme";
const COLOR_KEY = "tablet.color";
const SIZE_KEY = "tablet.size";

export const SIZES = [17, 19, 21, 24] as const;
export const DEFAULT_SIZE = 19;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode. The choice simply does not persist.
  }
}

export function getAppearance(): Appearance {
  const stored = read(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "auto";
}

export function setAppearance(value: Appearance) {
  write(THEME_KEY, value);
  if (value === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
}

export function getHighlightColor(): HighlightColor {
  return read(COLOR_KEY) === "blue" ? "blue" : "yellow";
}

export function setHighlightColor(value: HighlightColor) {
  write(COLOR_KEY, value);
}

export function getSize(): number {
  const stored = Number(read(SIZE_KEY));
  return SIZES.includes(stored as (typeof SIZES)[number]) ? stored : DEFAULT_SIZE;
}

export function setSize(value: number) {
  write(SIZE_KEY, String(value));
  document.documentElement.style.setProperty("--reading-size", `${value}px`);
}
