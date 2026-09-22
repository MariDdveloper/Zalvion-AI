import { useState } from "react";
import { X, Volume2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../lib/api";
import { LANGUAGES } from "../lib/i18n";

export default function TTSModal({ open, onClose, t, lang }) {
  const [ttsLang, setTtsLang] = useState(lang || "it");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  if (!open) return null;

  const generate = async () => {
    if (!text.trim()) { toast.error(t.ttsEmpty); return; }
    setBusy(true);
    setAudioUrl("");
    try {
      const res = await apiPost("/tts", { text: text.trim(), lang: ttsLang });
      setAudioUrl(res.audio_url);
    } catch (e) {
      toast.error(e.message || "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl" onClick={onClose}>
      <div data-testid="tts-modal" className="bg-[#FDFDF9] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="font-serif text-2xl flex items-center gap-2">
            <Volume2 size={22} className="text-[var(--primary)]" /> {t.ttsTitle}
          </h2>
          <button data-testid="tts-close-button" onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.ttsLangLabel}</label>
            <select data-testid="tts-language-select" value={ttsLang} onChange={(e) => setTtsLang(e.target.value)}
              className="w-full border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[var(--primary)] transition-colors">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">{t.ttsTextLabel}</label>
            <textarea data-testid="tts-text-input" value={text} onChange={(e) => setText(e.target.value.slice(0, 3000))}
              placeholder={t.ttsPlaceholder} rows={5}
              className="w-full border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 bg-white resize-none focus:outline-none focus:border-[var(--primary)] transition-colors" />
            <span data-testid="tts-char-count" className="text-xs text-[var(--text-secondary)]">{text.length}/3000</span>
          </div>
          <button data-testid="tts-generate-button" onClick={generate} disabled={busy || !text.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-full py-3.5 font-medium transition-colors">
            {busy ? <><Loader2 size={18} className="animate-spin" /> {t.ttsGenerating}</> : <><Volume2 size={18} /> {t.ttsGenerate}</>}
          </button>
          {audioUrl && (
            <div data-testid="tts-audio-result" className="space-y-2 fade-up">
              <audio controls autoPlay src={audioUrl} className="w-full" data-testid="tts-audio-player" />
              <a data-testid="tts-download-link" href={audioUrl} download="zalvion-tts.mp3"
                className="flex items-center justify-center gap-2 text-sm text-[var(--primary)] hover:underline">
                <Download size={14} /> {t.ttsDownload}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
