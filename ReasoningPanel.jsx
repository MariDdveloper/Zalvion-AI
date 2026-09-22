import { useState, useEffect } from "react";
import { Zap, Loader2 } from "lucide-react";

export default function ReasoningPanel({ steps, label }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1100);
    return () => clearInterval(iv);
  }, [steps.length]);

  return (
    <div className="flex gap-4 fade-up" data-testid="advanced-reasoning-panel">
      <div className="claus-orb flex-shrink-0 mt-1" style={{ width: 30, height: 30 }} />
      <div className="flex-1 border border-[var(--primary)]/30 bg-[var(--bg-accent)] rounded-2xl p-4">
        <p className="text-sm font-semibold text-[var(--primary)] flex items-center gap-1.5">
          <Zap size={15} /> {label}
        </p>
        <div className="mt-2.5 space-y-1.5">
          {steps.slice(0, i + 1).map((s, idx) => (
            <p key={idx} className="text-sm text-[var(--text-secondary)] flex items-center gap-2 fade-up">
              {idx === i ? <Loader2 size={13} className="animate-spin text-[var(--primary)]" /> : <span className="text-[var(--primary)]">✓</span>}
              {s}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
