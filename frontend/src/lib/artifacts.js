// Parses Zalvion AI "artifact" blocks out of an assistant message.
// Format produced by the model:
// <claus-artifact type="react" title="Todo App">
// <file path="/App.js">...code...</file>
// <file path="/styles.css">...code...</file>
// </claus-artifact>

export const PREVIEWABLE_TYPES = ["react", "static", "vanilla", "html"];

function normalizePath(p) {
  let path = (p || "").trim();
  if (!path.startsWith("/")) path = "/" + path;
  return path.replace(/\/{2,}/g, "/");
}

const FULL_RE = /<claus-artifact([^>]*)>([\s\S]*?)<\/claus-artifact>/g;
const FILE_RE = /<file\s+path="([^"]+)"\s*>\n?([\s\S]*?)\n?<\/file>/g;

function attr(attrs, name) {
  const m = attrs.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : null;
}

function parseFiles(inner) {
  const files = {};
  let fm;
  FILE_RE.lastIndex = 0;
  while ((fm = FILE_RE.exec(inner)) !== null) {
    files[normalizePath(fm[1])] = fm[2];
  }
  return files;
}

// Returns { text, artifacts:[{id,type,title,files}], pending:boolean }
// `text` has each artifact replaced by a token {{claus-artifact:ID}}.
export function parseMessage(content) {
  if (!content) return { text: "", artifacts: [], pending: false };
  const artifacts = [];
  let idx = 0;
  FULL_RE.lastIndex = 0;
  let text = content.replace(FULL_RE, (full, attrs, inner) => {
    const type = (attr(attrs, "type") || "react").toLowerCase();
    const title = attr(attrs, "title") || "Progetto";
    const files = parseFiles(inner);
    const id = idx++;
    artifacts.push({ id, type, title, files });
    return `\n\n{{claus-artifact:${id}}}\n\n`;
  });

  // Detect an artifact that has started streaming but is not closed yet.
  const lastOpen = content.lastIndexOf("<claus-artifact");
  const lastClose = content.lastIndexOf("</claus-artifact>");
  let pending = false;
  if (lastOpen > lastClose) {
    pending = true;
    text = text.slice(0, text.indexOf("<claus-artifact", lastClose + 1) === -1
      ? content.lastIndexOf("<claus-artifact")
      : content.lastIndexOf("<claus-artifact"));
    // simpler: cut everything from the last unclosed opening tag
    text = content.slice(0, lastOpen);
  }

  return { text: text.trim(), artifacts, pending };
}

export const TOKEN_SPLIT_RE = /\{\{claus-artifact:(\d+)\}\}/;
