// Client-side (browser) direct calls to Pollinations AI free endpoints.
// Runs from each user's browser (their own IP), so it is not affected by
// shared server-IP rate limits.

const TEXT_URL = "https://text.pollinations.ai/openai";
const IMAGE_URL = "https://image.pollinations.ai/prompt/";
const REFERRER = "zalvionai.com";

const LANG_NAMES = {
  it: "Italian", en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", nl: "Dutch", ru: "Russian", zh: "Chinese", ja: "Japanese",
  ar: "Arabic", hi: "Hindi", ko: "Korean", tr: "Turkish", pl: "Polish",
};

function systemPrompt(langName) {
  return (
    "You are Zalvion AI, an elite, world-class software engineer and AI assistant — the perfect AI, " +
    "especially for writing code. You reason deeply, explain clearly, and write flawless production-grade code. " +
    "Use Markdown formatting (headings, lists, tables, fenced code blocks with language ids). " +
    `Always answer in the user's language: ${langName}.\n\n` +
    "ARTIFACTS: When the user asks you to build, create, code or write a runnable PROJECT (a web app, component, " +
    "website, landing page, game, UI, dashboard, or a script/program in any language), output a COMPLETE, WORKING, " +
    "self-contained project wrapped EXACTLY like this:\n" +
    '<claus-artifact type="react" title="Short Title">\n' +
    '<file path="/App.js">\n...full file content...\n</file>\n' +
    '<file path="/styles.css">\n...full file content...\n</file>\n' +
    "</claus-artifact>\n\n" +
    "Rules: type is one of react, static, vanilla, node, python, other. " +
    "For react: provide at least /App.js with a default-exported React function component; import CSS with `import './styles.css'`; " +
    "DO NOT include index.js/package.json/index.html (auto-provided); use ONLY React and its hooks, no external npm packages. " +
    "For static: provide /index.html. Write FULLY working code — NEVER use placeholders, TODOs or ellipses. " +
    "Put ONE short sentence before the artifact and do NOT repeat the code outside it. " +
    "For normal (non-project) questions, reply with plain Markdown (short inline code snippets are fine, not wrapped in an artifact)."
  );
}

export function buildMessages(history, userText, langCode) {
  const langName = LANG_NAMES[langCode] || "English";
  const msgs = [{ role: "system", content: systemPrompt(langName) }];
  for (const m of history) {
    const role = m.role === "user" ? "user" : "assistant";
    let txt = m.content || " ";
    if (m.type === "image") txt = txt || "[generated an image]";
    msgs.push({ role, content: txt });
  }
  msgs.push({ role: "user", content: userText || " " });
  return msgs;
}

export function pollinationsImageUrl(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const p = encodeURIComponent(prompt || "a beautiful high quality image");
  return `${IMAGE_URL}${p}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true&referrer=${REFERRER}`;
}

// Streams a chat completion directly from the browser. Calls onDelta for each
// text chunk. Returns { promise, controller }. Resilient to chunk splits.
export function streamPollinationsText(messages, { onDelta } = {}) {
  const controller = new AbortController();
  const promise = (async () => {
    const res = await fetch(TEXT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages, stream: true, referrer: REFERRER }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Pollinations HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let gotAny = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let obj;
        try { obj = JSON.parse(data); } catch { continue; }
        const delta = obj?.choices?.[0]?.delta?.content;
        if (delta) { gotAny = true; full += delta; onDelta?.(delta); }
      }
    }
    if (!gotAny) throw new Error("Empty response");
    return full;
  })();
  return { promise, controller };
}
