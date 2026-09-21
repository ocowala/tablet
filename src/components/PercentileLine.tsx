"use client";

/**
 * The only number a reader ever sees. The percentile is set large and sits
 * exactly on the centre line.
 */
export function PercentileLine({ percentile }: { percentile: number }) {
  return (
    <div className="animate-fade-in mt-6 text-center" aria-live="polite">
      <div className="text-[15px] secondary">Your answer beats</div>
      <div className="leading-none" style={{ fontSize: "3.4rem", fontWeight: 300 }}>
        {percentile}%
      </div>
      <div className="text-[15px] secondary">of readers</div>
    </div>
  );
}
