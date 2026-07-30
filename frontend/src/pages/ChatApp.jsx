import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete, saveUserMessage, saveAssistantMessage, generateAI } from "../lib/api";
import { pollinationsImageUrl } from "../lib/pollinations";
import { getT } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Composer from "../components/Composer";
import MessageItem from "../components/MessageItem";
import DownloadModal from "../components/DownloadModal";
import CodeArtifact from "../components/CodeArtifact";
import { parseMessage } from "../lib/artifacts";
import { Sparkles } from "lucide-react";

export default function ChatApp() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [lang, setLang] = useState(localStorage.getItem("claus_lang") || "it");
  const t = getT(lang);
  const [chats, setChats] = useState([]);
  const [folders, setFolders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [web, setWeb] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const controllerRef = useRef(null);
  const scrollRef = useRef(null);
  const justCreatedRef = useRef(null);

  const openArtifact = useCallback((art) => setActiveArtifact(art), []);

  const limitMsg = () => `Daily limit reached (${user?.usage_used || 0}/${user?.usage_limit || 10} tokens used). Recharging compute nodes. Please return tomorrow.`;

  const loadChats = useCallback(async () => setChats(await apiGet("/chats").catch(() => [])), []);
  const loadFolders = useCallback(async () => setFolders(await apiGet("/folders").catch(() => [])), []);

  useEffect(() => { loadChats(); loadFolders(); }, [loadChats, loadFolders]);

  useEffect(() => {
    setActiveArtifact(null);
    if (!chatId) { setMessages([]); return; }
    if (justCreatedRef.current === chatId) { justCreatedRef.current = null; return; }
    apiGet(`/chats/${chatId}/messages`).then((d) => setMessages(d.messages || [])).catch(() => navigate("/"));
  }, [chatId, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const setLanguage = (c) => { setLang(c); localStorage.setItem("claus_lang", c); };

  const newChat = async () => {
    const c = await apiPost("/chats");
    setChats((p) => [c, ...p]);
    setMessages([]);
    navigate(`/c/${c.chat_id}`);
    setSidebarOpen(false);
  };

  const deleteChat = async (id) => {
    await apiDelete(`/chats/${id}`);
    setChats((p) => p.filter((c) => c.chat_id !== id));
    if (id === chatId) { setMessages([]); navigate("/"); }
  };

  const renameChat = async (id, title) => {
    if (!title.trim()) return;
    setChats((p) => p.map((c) => c.chat_id === id ? { ...c, title } : c));
    await apiPatch(`/chats/${id}`, { title }).catch((e) => toast.error(e.message));
  };

  const moveChat = async (id, folderId) => {
    setChats((p) => p.map((c) => c.chat_id === id ? { ...c, folder_id: folderId } : c));
    await apiPatch(`/chats/${id}`, folderId === null ? { clear_folder: true } : { folder_id: folderId }).catch((e) => toast.error(e.message));
  };

  const createFolder = async (name) => {
    try { const f = await apiPost("/folders", { name }); setFolders((p) => [...p, f]); return f; }
    catch (e) { toast.error(e.message); }
  };
  const renameFolder = async (id, name) => {
    setFolders((p) => p.map((f) => f.folder_id === id ? { ...f, name } : f));
    await apiPatch(`/folders/${id}`, { name }).catch((e) => toast.error(e.message));
  };
  const deleteFolder = async (id) => {
    await apiDelete(`/folders/${id}`);
    setFolders((p) => p.filter((f) => f.folder_id !== id));
    setChats((p) => p.map((c) => c.folder_id === id ? { ...c, folder_id: null } : c));
  };

  const limitReached = user && user.usage_used >= user.usage_limit;

  const handleSend = async (payload) => {
    if (limitReached) { toast.error(limitMsg()); return; }
    let activeChatId = chatId;
    if (!activeChatId) {
      const c = await apiPost("/chats");
      setChats((p) => [c, ...p]);
      activeChatId = c.chat_id;
      justCreatedRef.current = c.chat_id;
      navigate(`/c/${c.chat_id}`);
    }
    const historySnapshot = messages;
    const userMsg = { id: "u" + Date.now(), role: "user", type: "text", content: payload.content, attachments: payload.attachmentsMeta };
    const asstId = "a" + Date.now();
    const isImage = payload.mode === "image";
    const asstMsg = { id: asstId, role: "assistant", type: isImage ? "image" : "text", content: "", image_url: "" };
    setMessages((p) => [...p, userMsg, asstMsg]);
    setBusy(true);
    setStreamingId(asstId);

    // 1) Persist user message + enforce daily limit (server-side)
    let saved;
    try {
      saved = await saveUserMessage(activeChatId, { content: payload.content, attachments: payload.attachmentsMeta || [] });
    } catch (e) {
      setBusy(false); setStreamingId(null);
      setMessages((p) => p.filter((m) => m.id !== asstId && m.id !== userMsg.id));
      toast.error(String(e.message || "").toLowerCase().includes("limit") ? limitMsg() : (e.message || "Errore"));
      checkAuth();
      return;
    }
    if (saved?.title) setChats((p) => p.map((c) => c.chat_id === activeChatId ? { ...c, title: saved.title } : c));

    // 2) Generate directly from the browser (Pollinations)
    if (isImage) {
      const url = pollinationsImageUrl(payload.content || "");
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, type: "image", image_url: url, content: "" } : m));
      setBusy(false); setStreamingId(null);
      await saveAssistantMessage(activeChatId, { type: "image", image_url: url, content: "" }).catch(() => {});
      loadChats(); checkAuth();
      return;
    }

    const convo = [
      ...historySnapshot.map((m) => ({ role: m.role, content: m.content || (m.type === "image" ? "[immagine generata]" : "") })),
      { role: "user", content: payload.content || "" },
    ];
    try {
      const res = await generateAI({ messages: convo, language: lang });
      const full = res.content || "";
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: full } : m));
      setBusy(false); setStreamingId(null);
      const arts = parseMessage(full).artifacts;
      if (arts.length) setActiveArtifact(arts[arts.length - 1]);
      await saveAssistantMessage(activeChatId, { type: "text", content: full }).catch(() => {});
      loadChats(); checkAuth();
    } catch (e) {
      setBusy(false); setStreamingId(null);
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: m.content || "Errore di connessione con l'AI. Riprova." } : m));
    }
  };

  const handleRegenerate = async () => {
    if (!chatId || busy) return;
    let base = messages;
    if (base.length && base[base.length - 1].role === "assistant") base = base.slice(0, -1);
    const lastUser = [...base].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const historyForRegen = base.slice(0, base.indexOf(lastUser));
    const asstId = "a" + Date.now();
    setMessages([...base, { id: asstId, role: "assistant", type: "text", content: "" }]);
    setBusy(true);
    setStreamingId(asstId);
    const convo = historyForRegen.map((m) => ({ role: m.role, content: m.content || (m.type === "image" ? "[immagine generata]" : "") }));
    convo.push({ role: "user", content: lastUser.content || "" });
    try {
      const res = await generateAI({ messages: convo, language: lang });
      const full = res.content || "";
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: full } : m));
      setBusy(false); setStreamingId(null);
      const arts = parseMessage(full).artifacts;
      if (arts.length) setActiveArtifact(arts[arts.length - 1]);
      await saveAssistantMessage(chatId, { type: "text", content: full, replace_last: true }).catch(() => {});
      loadChats();
    } catch (e) {
      setBusy(false); setStreamingId(null);
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: m.content || "Errore di connessione." } : m));
    }
  };

  const stop = () => { controllerRef.current?.abort(); setBusy(false); setStreamingId(null); };

  const empty = messages.length === 0;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant" && m.type === "text")?.id;
  const streamingMsg = streamingId ? messages.find((m) => m.id === streamingId) : null;
  const showThinking = streamingMsg && streamingMsg.content === "" && streamingMsg.type !== "image";

  const sidebarProps = {
    chats, folders, activeId: chatId, onNew: newChat, onDelete: deleteChat,
    onRename: renameChat, onMove: moveChat, onNewFolder: createFolder,
    onRenameFolder: renameFolder, onDeleteFolder: deleteFolder,
    lang, onLang: setLanguage, t, onDownload: () => setShowDownload(true),
    user,
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--bg-main)]">
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar {...sidebarProps} onSelect={(id) => navigate(`/c/${id}`)} onClose={() => {}} />
      </div>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-shrink-0">
            <Sidebar {...sidebarProps}
              onSelect={(id) => { navigate(`/c/${id}`); setSidebarOpen(false); }}
              onClose={() => setSidebarOpen(false)}
              onDownload={() => { setShowDownload(true); setSidebarOpen(false); }} />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex min-w-0">
      <div className={`flex flex-col min-w-0 h-full ${activeArtifact ? "hidden md:flex md:w-[42%] md:border-r md:border-[var(--border-subtle)]" : "flex-1"}`}>
        <header className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)] lg:border-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-black/5"><Menu size={20} /></button>
            <span className="lg:hidden font-serif text-lg">Zalvion AI</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1"><Sparkles size={13} className="text-[var(--primary)]" /> {user?.usage_used || 0}/{user?.usage_limit || 10}</span>
        </header>

        {empty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-3xl fade-up">
              <div className="flex flex-col items-center text-center mb-10">
                <div className="claus-orb mb-5" style={{ width: 56, height: 56 }} />
                <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">{t.greeting}</h1>
              </div>
              <Composer onSend={handleSend} busy={busy} onStop={stop} web={web} setWeb={setWeb} t={t} lang={lang} />
              <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-2xl mx-auto">
                {t.sugg.map((s, i) => (
                  <button key={i} data-testid={`suggestion-${i}`} onClick={() => handleSend({ content: s, images: [], files: [], mode: "chat", web, attachmentsMeta: [] })}
                    className="flex items-center gap-2 text-sm border border-[var(--border-subtle)] bg-white rounded-full px-4 py-2 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                    <Sparkles size={14} /> {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="messages-container">
              <div className="max-w-3xl mx-auto px-4 py-8 space-y-7">
                {messages.map((m) => (
                  <MessageItem key={m.id} message={m}
                    isStreaming={streamingId === m.id && !m.content && m.type !== "image"}
                    canRegenerate={!busy && m.id === lastAssistantId}
                    onRegenerate={handleRegenerate} onOpenArtifact={openArtifact} t={t} />
                ))}
                {showThinking && (
                  <div className="flex gap-4">
                    <div className="claus-orb flex-shrink-0" style={{ width: 30, height: 30 }} />
                    <p className="text-[var(--text-secondary)] italic mt-1">{t.thinking}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="pb-4 pt-2">
              <Composer onSend={handleSend} busy={busy} onStop={stop} web={web} setWeb={setWeb} t={t} lang={lang} />
            </div>
          </>
        )}
        </div>
        {activeArtifact && (
          <CodeArtifact artifact={activeArtifact} lang={lang} onClose={() => setActiveArtifact(null)} className="flex-1 h-full" />
        )}
      </div>

      <DownloadModal open={showDownload} onClose={() => setShowDownload(false)} t={t} />
    </div>
  );
}
