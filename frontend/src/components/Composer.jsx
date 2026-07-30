import { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, Mic, Globe, ImagePlus, X, Square, FileText } from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES } from "../lib/i18n";

export default function Composer({ onSend, busy, onStop, web, setWeb, t, lang }) {
  const [text, setText] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [listening, setListening] = useState(false);
  const taRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + "px";
    }
  }, [text]);

  const handleFiles = async (files) => {
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        const b64 = await toBase64(file);
        setAttachments((a) => [...a, { name: file.name, kind: "image", b64: b64.split(",")[1], preview: b64 }]);
      } else {
        const txt = await file.text().catch(() => "");
        setAttachments((a) => [...a, { name: file.name, kind: "file", text: txt.slice(0, 60000) }]);
      }
    }
  };

  const send = () => {
    if (busy) return;
    if (!text.trim() && attachments.length === 0) return;
    const images = attachments.filter((a) => a.kind === "image").map((a) => a.b64);
    const fileTexts = attachments.filter((a) => a.kind === "file").map((a) => ({ name: a.name, text: a.text }));
    onSend({
      content: text.trim(),
      images,
      files: fileTexts,
      mode: imageMode ? "image" : "chat",
      web,
      attachmentsMeta: attachments.map((a) => ({ name: a.name, kind: a.kind })),
    });
    setText("");
    setAttachments([]);
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast.error("Voice input not supported in this browser");
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = LANGUAGES.find((l) => l.code === lang)?.speech || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      if (e.results[0].isFinal) setText((prev) => (prev ? prev + " " : "") + s);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-[var(--border-subtle)] rounded-xl pl-2 pr-1 py-1 text-sm">
              {a.kind === "image" ? <img src={a.preview} alt="" className="w-7 h-7 rounded object-cover" /> : <FileText size={16} />}
              <span className="max-w-[120px] truncate">{a.name}</span>
              <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} className="p-1 hover:bg-black/5 rounded-full"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="bg-white rounded-[26px] border border-[var(--border-subtle)] shadow-[0_4px_24px_rgba(45,42,38,0.06)] px-3 pt-3 pb-2">
        <textarea
          data-testid="chat-composer-input"
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={imageMode ? t.image + "…" : t.placeholder}
          className="w-full resize-none outline-none bg-transparent px-2 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 max-h-[200px]"
        />
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <label data-testid="attach-button" className="p-2 rounded-full hover:bg-black/[0.05] cursor-pointer transition-colors" title={t.attach}>
              <Paperclip size={18} strokeWidth={1.7} className="text-[var(--text-secondary)]" />
              <input type="file" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files))} />
            </label>
            <button data-testid="image-mode-toggle" onClick={() => setImageMode(!imageMode)} title={t.image}
              className={`p-2 rounded-full transition-colors ${imageMode ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "hover:bg-black/[0.05] text-[var(--text-secondary)]"}`}>
              <ImagePlus size={18} strokeWidth={1.7} />
            </button>
            <button data-testid="web-toggle" onClick={() => setWeb(!web)} title={t.web}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ${web ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "hover:bg-black/[0.05] text-[var(--text-secondary)]"}`}>
              <Globe size={16} strokeWidth={1.7} /> <span className="hidden sm:inline">{t.web}</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button data-testid="voice-input-button" onClick={toggleVoice} title={t.voice}
              className={`p-2.5 rounded-full transition-colors ${listening ? "bg-[var(--error)] text-white animate-pulse" : "hover:bg-black/[0.05] text-[var(--text-secondary)]"}`}>
              <Mic size={18} strokeWidth={1.8} />
            </button>
            {busy ? (
              <button data-testid="chat-stop-button" onClick={onStop} className="p-2.5 rounded-full bg-[var(--text-primary)] text-white transition-colors">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button data-testid="chat-send-button" onClick={send} disabled={!text.trim() && attachments.length === 0}
                className="p-2.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowUp size={18} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </div>
      {listening && <p className="text-center text-xs text-[var(--error)] mt-1.5">{t.listening}</p>}
      <p className="text-center text-[11px] text-[var(--text-secondary)]/60 mt-2 mb-1">Zalvion AI</p>
    </div>
  );
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
