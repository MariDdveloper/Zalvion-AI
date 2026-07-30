import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES } from "../lib/i18n";

export default function LanguageMenu({ lang, onChange, t, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button data-testid="language-menu-button" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm rounded-full border border-[var(--border-subtle)] bg-white px-3 py-2 hover:bg-black/[0.03] transition-colors">
        <Globe size={16} strokeWidth={1.7} />
        {!compact && <span>{current.flag} {current.label}</span>}
        {compact && <span>{current.flag}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 max-h-80 overflow-auto bg-white border border-[var(--border-subtle)] rounded-2xl shadow-xl p-1.5 z-50 fade-up">
          {LANGUAGES.map((l) => (
            <button key={l.code} data-testid={`lang-option-${l.code}`}
              onClick={() => { onChange(l.code); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm hover:bg-black/[0.04] transition-colors">
              <span>{l.flag} {l.label}</span>
              {l.code === lang && <Check size={15} className="text-[var(--primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
