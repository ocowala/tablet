"use client";

/** Tries used. No counters, no labels. */
export function AttemptDots({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${used} of ${total} tries used`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: "var(--ink)",
            opacity: i < used ? 0.85 : 0.2,
          }}
        />
      ))}
    </div>
  );
}
