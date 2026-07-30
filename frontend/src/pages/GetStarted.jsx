import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Star, Code2, Zap, Globe } from "lucide-react";
import { LETTER_LANGS, getLetterLang, detectLetterLang } from "../lib/letter";
import { getReviews } from "../lib/marketing";

export default function GetStarted() {
  const navigate = useNavigate();
  const [langCode, setLangCode] = useState(detectLetterLang());
  const L = getLetterLang(langCode);
  const reviews = getReviews(langCode === "it" ? "it" : "en").slice(0, 3);

  const startGoogle = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] text-white relative overflow-x-hidden">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-[#7C3AED] opacity-25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[34rem] h-[34rem] rounded-full bg-[#2563EB] opacity-20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[30rem] h-[30rem] rounded-full bg-[#DB2777] opacity-15 blur-[130px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles size={18} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Zalvion AI</span>
        </div>
        <select data-testid="letter-lang-select" value={langCode} onChange={(e) => setLangCode(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm outline-none hover:bg-white/10 transition-colors cursor-pointer backdrop-blur-md">
          {LETTER_LANGS.map((l) => (
            <option key={l.code} value={l.code} className="bg-[#14141c] text-white">{l.label}</option>
          ))}
        </select>
      </nav>

      {/* Hero + letter */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-8 pb-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-purple-200 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-md">
          <Zap size={13} className="text-purple-300" /> {langCode === "it" ? "La tua IA perfetta per il codice" : "Your perfect AI for code"}
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
          Zalvion AI
        </h1>

        {/* Glass letter card */}
        <div data-testid="open-letter-card"
          className="mt-10 w-full rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-7 sm:p-10 shadow-2xl shadow-black/40">
          <p className="text-[11px] uppercase tracking-[0.25em] text-purple-300/80 mb-5">{L.greeting}</p>
          <p dir={L.rtl ? "rtl" : "ltr"}
            className="text-base sm:text-lg leading-relaxed text-white/85 whitespace-pre-wrap">
            {L.letter}
          </p>
          {/* Signature */}
          <div className="mt-8 flex flex-col items-end">
            <span data-testid="signature" className="signature-glow text-3xl sm:text-4xl text-white pr-2"
              style={{ fontFamily: "'Great Vibes', cursive" }}>
              Mari_Developer
            </span>
            <span className="text-xs text-white/40 mt-1 pr-2">{langCode === "it" ? "Sviluppatore ufficiale" : "Official developer"}</span>
          </div>
        </div>

        {/* CTA */}
        <button data-testid="get-started-button" onClick={startGoogle}
          className="cta-pulse group mt-10 inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold text-white shadow-xl">
          {L.cta}
          <ArrowRight size={19} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <button data-testid="email-login-link" onClick={() => navigate("/login")}
          className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors">
          {langCode === "it" ? "oppure accedi con email" : "or sign in with email"}
        </button>

        {/* Feature chips */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {[
            { icon: Code2, t: langCode === "it" ? "Anteprima codice live" : "Live code preview" },
            { icon: Sparkles, t: langCode === "it" ? "Immagini generate gratis" : "Free image generation" },
            { icon: Globe, t: langCode === "it" ? "15 lingue · gratis" : "15 languages · free" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
              <f.icon size={17} className="text-purple-300 flex-shrink-0" />
              <span className="text-sm text-white/75 text-left">{f.t}</span>
            </div>
          ))}
        </div>

        {/* Reviews */}
        <div className="mt-16 w-full">
          <p className="text-sm text-white/50 mb-5">{langCode === "it" ? "Amato da programmatori e studenti" : "Loved by developers and students"}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {reviews.map((r, i) => (
              <div key={i} data-testid={`review-${i}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-md">
                <div className="flex gap-0.5 mb-2">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={12} className="fill-purple-300 text-purple-300" />)}</div>
                <p className="text-sm text-white/80 leading-relaxed">"{r.text}"</p>
                <p className="text-xs text-white/40 mt-2.5 font-medium">{r.name} · {r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
