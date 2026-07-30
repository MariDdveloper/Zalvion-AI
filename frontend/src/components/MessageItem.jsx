import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileText, Image as ImageIcon, RefreshCw, Code2, Loader2, ArrowRight } from "lucide-react";
import { parseMessage, TOKEN_SPLIT_RE } from "../lib/artifacts";

function ArtifactCard({ artifact, onOpen }) {
  return (
    <button data-testid="artifact-card" onClick={() => onOpen?.(artifact)}
      className="group/art flex items-center gap-3 w-full max-w-md my-3 text-left rounded-2xl border border-[var(--border-subtle)] bg-white hover:border-[var(--primary)] hover:shadow-md transition-all px-4 py-3">
      <div className="claus-orb flex-shrink-0" style={{ width: 34, height: 34 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate flex items-center gap-1.5"><Code2 size={14} className="text-[var(--primary)]" /> {artifact.title}</p>
        <p className="text-xs text-[var(--text-secondary)]">{Object.keys(artifact.files).length} file · {artifact.type}</p>
      </div>
      <ArrowRight size={16} className="text-[var(--text-secondary)] group-hover/art:text-[var(--primary)] group-hover/art:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
}

function BuildingCard() {
  return (
    <div data-testid="artifact-building" className="flex items-center gap-3 w-full max-w-md my-3 rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3">
      <Loader2 size={20} className="animate-spin text-[var(--primary)] flex-shrink-0" />
      <p className="text-sm text-[var(--text-secondary)]">Generazione del progetto…</p>
    </div>
  );
}

function CodeBlock({ inline, className, children }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");
  if (inline || !match) return <code className={className}>{children}</code>;
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#F3F2EC] text-xs text-[var(--text-secondary)] font-mono">
        <span>{match[1]}</span>
        <button onClick={copy} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter language={match[1]} style={oneLight} customStyle={{ margin: 0, background: "#FBFAF6", fontSize: "0.85rem", padding: "1rem" }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MessageItem({ message, isStreaming, canRegenerate, onRegenerate, onOpenArtifact, t }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end fade-up" data-testid="message-user">
        <div className="max-w-[80%]">
          {message.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end mb-2">
              {message.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-black/[0.04] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5">
                  {a.kind === "image" ? <ImageIcon size={13} /> : <FileText size={13} />}{a.name || (a.kind === "image" ? "image" : "file")}
                </div>
              ))}
            </div>
          )}
          {message.content && (
            <div className="bg-black/[0.05] rounded-2xl px-5 py-3 text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 fade-up group" data-testid="message-assistant">
      <div className="claus-orb flex-shrink-0 mt-1" style={{ width: 30, height: 30 }} />
      <div className="flex-1 min-w-0">
        {message.type === "image" && message.image_url ? (
          <div>
            <img src={message.image_url} alt="generated" className="rounded-2xl max-w-md w-full border border-[var(--border-subtle)] shadow-sm" />
            {message.content && <p className="text-sm text-[var(--text-secondary)] mt-2">{message.content}</p>}
          </div>
        ) : (
          <div className={`prose-claus max-w-none ${isStreaming ? "caret-blink" : ""}`}>
            {(() => {
              const { text, artifacts, pending } = parseMessage(message.content || "");
              const segments = text.split(TOKEN_SPLIT_RE);
              return (
                <>
                  {segments.map((seg, i) => {
                    if (i % 2 === 1) {
                      const art = artifacts.find((a) => String(a.id) === seg);
                      return art ? <ArtifactCard key={i} artifact={art} onOpen={onOpenArtifact} /> : null;
                    }
                    if (!seg.trim()) return null;
                    return (
                      <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
                        {seg}
                      </ReactMarkdown>
                    );
                  })}
                  {pending && <BuildingCard />}
                </>
              );
            })()}
          </div>
        )}
        {!isStreaming && message.type !== "image" && message.content && (
          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button data-testid="copy-message-button" onClick={() => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? (t?.copied || "Copied") : (t?.copy || "Copy")}
            </button>
            {canRegenerate && (
              <button data-testid="regenerate-button" onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)]">
                <RefreshCw size={13} /> {t?.regenerate || "Regenerate"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageItem);
