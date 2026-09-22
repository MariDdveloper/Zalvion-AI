import { useState, useMemo, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { X, Eye, Code2, FileCode, Download, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { PREVIEWABLE_TYPES } from "../lib/artifacts";
import { buildPreviewSrcDoc } from "../lib/preview";

const LABELS = {
  it: { preview: "Anteprima", code: "Codice", noPreview: "Anteprima live non disponibile per questo linguaggio. Consulta il codice qui a fianco.", files: "file", download: "Scarica", refresh: "Ricarica" },
  en: { preview: "Preview", code: "Code", noPreview: "Live preview isn't available for this language. Browse the code instead.", files: "files", download: "Download", refresh: "Reload" },
  es: { preview: "Vista previa", code: "Código", noPreview: "Vista previa no disponible para este lenguaje.", files: "archivos", download: "Descargar", refresh: "Recargar" },
  fr: { preview: "Aperçu", code: "Code", noPreview: "Aperçu indisponible pour ce langage.", files: "fichiers", download: "Télécharger", refresh: "Recharger" },
  de: { preview: "Vorschau", code: "Code", noPreview: "Vorschau für diese Sprache nicht verfügbar.", files: "Dateien", download: "Herunterladen", refresh: "Neu laden" },
  pt: { preview: "Pré-visualização", code: "Código", noPreview: "Pré-visualização indisponível para esta linguagem.", files: "ficheiros", download: "Descarregar", refresh: "Recarregar" },
};

function extToLang(path) {
  const ext = path.split(".").pop().toLowerCase();
  const map = { js: "jsx", jsx: "jsx", ts: "tsx", tsx: "tsx", py: "python", css: "css", html: "markup", json: "json", md: "markdown", sh: "bash", go: "go", rs: "rust", java: "java" };
  return map[ext] || "text";
}

function downloadFiles(artifact) {
  Object.entries(artifact.files).forEach(([path, code]) => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.replace(/^\//, "").replace(/\//g, "_");
    a.click();
    URL.revokeObjectURL(url);
  });
}
function buildPythonPreviewSrcDoc(artifact) {
  const entryPath = Object.keys(artifact.files).find((p) => p.endsWith(".py")) || Object.keys(artifact.files)[0];
  const code = artifact.files[entryPath] || "";
  const encoded = JSON.stringify(code).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { margin:0; font-family: ui-monospace, "SF Mono", monospace; background:#0F0F0F; color:#E8E8E0; }
  #output { white-space: pre-wrap; padding: 16px; font-size: 13px; line-height: 1.6; box-sizing: border-box; }
  #output .err { color: #FF6B6B; }
  #output .warn { color: #E8B84B; }
  #status { padding: 8px 16px; color: #888; font-size: 12px; border-bottom: 1px solid #222; }
</style></head>
<body>
<div id="status">Loading Python runtime\u2026</div>
<div id="output"></div>
<script src="https://cdn.jsdelivr.net/pyodide/v314.0.5/full/pyodide.js"></script>
<script>
  const out = document.getElementById("output");
  const status = document.getElementById("status");
  function write(text, cls) {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    out.appendChild(span);
  }
  function detectImports(code) {
    const stdlib = new Set(["sys","os","math","random","time","datetime","json","re",
      "itertools","functools","collections","typing","dataclasses","enum","io",
      "string","statistics","decimal","fractions","copy","abc","heapq","bisect",
      "array","struct","hashlib","base64","uuid","pathlib","textwrap","operator"]);
    const seen = new Set();
    for (const rawLine of code.split("\\n")) {
      const line = rawLine.trim();
      let m;
      if ((m = line.match(/^from\\s+([a-zA-Z_][a-zA-Z0-9_]*)/))) {
        seen.add(m[1]);
      } else if ((m = line.match(/^import\\s+(.+)/))) {
        for (const part of m[1].split(",")) {
          const mm = part.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (mm) seen.add(mm[1]);
        }
      }
    }
    return [...seen].filter((mod) => !stdlib.has(mod));
  }
  async function main() {
    let pyodide;
    try {
      pyodide = await loadPyodide();
    } catch (e) {
      status.textContent = "";
      write("Failed to load the Python runtime: " + String(e), "err");
      return;
    }

    pyodide.setStdout({ batched: (s) => write(s + "\\n", null) });
    pyodide.setStderr({ batched: (s) => write(s + "\\n", "err") });

    const code = ${encoded};

    try {
      status.textContent = "Loading packages\u2026";
      await pyodide.loadPackage("micropip");
      const micropip = pyodide.pyimport("micropip");
      await pyodide.loadPackagesFromImports(code);
      for (const mod of detectImports(code)) {
        try {
          pyodide.pyimport(mod);
        } catch {
          try {
            await micropip.install(mod);
          } catch (pkgErr) {
            write("Warning: could not install package '" + mod + "' (" + String(pkgErr) + ")\\n", "warn");
          }
        }
      }
    } catch (e) {
      write("Warning: package setup issue (" + String(e) + ")\\n", "warn");
    }

    try {
      status.textContent = "";
      await pyodide.runPythonAsync(code);
    } catch (e) {
      status.textContent = "";
      write(String(e), "err");
    }
  }
  main();
</script>
</body></html>`;
}
function CodeView({ artifact }) {
  const paths = Object.keys(artifact.files);
  const [active, setActive] = useState(paths[0]);
  const [copied, setCopied] = useState(false);
  const code = artifact.files[active] || "";
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex h-full min-h-0">
      <div className="w-48 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[#F7F6F0] overflow-y-auto py-2" data-testid="artifact-file-tree">
        {paths.map((p) => (
          <button key={p} data-testid={`artifact-file-${p.replace(/[^a-z0-9]/gi, "-")}`} onClick={() => setActive(p)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left truncate transition-colors ${active === p ? "bg-[var(--primary)]/12 text-[var(--primary)] font-medium" : "text-[var(--text-secondary)] hover:bg-black/[0.04]"}`}>
            <FileCode size={13} className="flex-shrink-0" /> {p.replace(/^\//, "")}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)]">
          <span className="truncate">{active}</span>
          <button data-testid="artifact-copy-file" onClick={copy} className="flex items-center gap-1 hover:text-[var(--text-primary)]">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
        </div>
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter language={extToLang(active)} style={oneLight} customStyle={{ margin: 0, background: "#FBFAF6", fontSize: "0.8rem", padding: "1rem", minHeight: "100%" }}>
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}

export default function CodeArtifact({ artifact, onClose, lang, className = "" }) {
  const L = LABELS[lang] || LABELS.en;
  const previewable = PREVIEWABLE_TYPES.includes(artifact.type) && Object.keys(artifact.files).length > 0;
  const [tab, setTab] = useState(previewable ? "preview" : "code");
  const [reloadKey, setReloadKey] = useState(0);
  const fileCount = Object.keys(artifact.files).length;
  const iframeRef = useRef(null);

  const srcDoc = useMemo(() => {
    try { return previewable ? buildPreviewSrcDoc(artifact) : ""; }
    catch { return ""; }
  }, [artifact, previewable]);

  return (
    <div className={`flex flex-col min-w-0 bg-[#FDFDF9] ${className}`} data-testid="code-artifact-panel">
      <div className="flex items-center justify-between px-3 h-12 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center gap-1 bg-black/[0.05] rounded-full p-1">
          <button data-testid="artifact-tab-preview" onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-colors ${tab === "preview" ? "bg-white shadow-sm font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
            <Eye size={14} /> {L.preview}
          </button>
          <button data-testid="artifact-tab-code" onClick={() => setTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-colors ${tab === "code" ? "bg-white shadow-sm font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
            <Code2 size={14} /> {L.code}
          </button>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="hidden md:block text-xs text-[var(--text-secondary)] truncate max-w-[150px] mr-1">{artifact.title} · {fileCount} {L.files}</span>
          {previewable && tab === "preview" && (
            <button data-testid="artifact-refresh" onClick={() => setReloadKey((k) => k + 1)} title={L.refresh} className="p-2 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)]"><RefreshCw size={15} /></button>
          )}
          <button data-testid="artifact-download" onClick={() => downloadFiles(artifact)} title={L.download} className="p-2 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)]"><Download size={16} /></button>
          <button data-testid="artifact-close" onClick={onClose} className="p-2 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)]"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {previewable && (
          <div className="absolute inset-0 bg-white" style={{ display: tab === "preview" ? "block" : "none" }}>
            <iframe key={reloadKey} ref={iframeRef} title="preview" data-testid="artifact-preview-iframe"
              srcDoc={srcDoc} sandbox="allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock"
              className="w-full h-full border-0" />
          </div>
        )}
        <div className="absolute inset-0" style={{ display: tab === "code" ? "block" : "none" }}>
          <CodeView artifact={artifact} />
        </div>
        {!previewable && tab === "preview" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <AlertTriangle size={30} className="text-[var(--text-secondary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)] max-w-xs">{L.noPreview}</p>
          </div>
        )}
      </div>
    </div>
  );
}
