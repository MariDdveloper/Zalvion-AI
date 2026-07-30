// Builds a fully self-contained HTML document (for an <iframe srcDoc>) that runs
// React / vanilla-JS / static artifacts in the browser with NO external bundler.
// React + Babel are loaded from CDN; a tiny CommonJS runtime resolves local files.

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inlineStatic(files) {
  let html = files["/index.html"] || Object.values(files)[0] || "<!doctype html><html><body></body></html>";
  for (const [p, code] of Object.entries(files)) {
    const name = p.replace(/^\//, "");
    if (p.endsWith(".css")) {
      const re = new RegExp(`<link[^>]*href=["']\\.?/?${reEscape(name)}["'][^>]*>`, "g");
      html = html.replace(re, `<style>\n${code}\n</style>`);
    } else if (p.endsWith(".js")) {
      const re = new RegExp(`<script[^>]*src=["']\\.?/?${reEscape(name)}["'][^>]*>\\s*</script>`, "g");
      html = html.replace(re, `<script>\n${code}\n</script>`);
    }
  }
  return html;
}

const RUNTIME = `
(function () {
  function dirname(p){ return p.slice(0, p.lastIndexOf('/')) || ''; }
  function normalize(p){
    var parts = p.split('/'); var out = [];
    for (var i=0;i<parts.length;i++){ var s=parts[i];
      if (s==='' || s==='.') continue;
      if (s==='..') out.pop(); else out.push(s);
    }
    return '/' + out.join('/');
  }
  var CACHE = {};
  function requireFrom(fromPath, req){
    if (req === 'react') return React;
    if (req === 'react-dom' || req === 'react-dom/client') return ReactDOM;
    if (/\\.css$/.test(req)) return {};
    var target = req;
    if (req[0] === '.') target = normalize(dirname(fromPath) + '/' + req);
    else if (req[0] === '/') target = req;
    else { console.warn('External module stubbed:', req); return {}; }
    var cands = [target, target+'.js', target+'.jsx', target+'.ts', target+'.tsx', target+'/index.js', target+'/index.jsx'];
    for (var i=0;i<cands.length;i++){ if (FILES[cands[i]] != null) return evalModule(cands[i]); }
    throw new Error('Cannot resolve "' + req + '" from ' + fromPath);
  }
  function evalModule(path){
    if (CACHE[path]) return CACHE[path].exports;
    var code = FILES[path];
    if (code == null) throw new Error('Module not found: ' + path);
    var module = { exports: {} };
    CACHE[path] = module;
    var presets = [['react', { runtime: 'classic' }]];
    if (/\\.tsx?$/.test(path)) presets.push('typescript');
    var out = Babel.transform(code, { presets: presets, plugins: ['transform-modules-commonjs'], filename: path.slice(1) }).code;
    var localRequire = function(req){ return requireFrom(path, req); };
    var fn = new Function('require','module','exports','React','ReactDOM', out);
    fn(localRequire, module, module.exports, React, ReactDOM);
    return module.exports;
  }
  function showError(e){
    var msg = (e && e.stack) ? e.stack : String(e);
    document.getElementById('root').innerHTML =
      '<div style="font:13px/1.5 ui-monospace,Menlo,monospace;color:#b42318;background:#fef3f2;border:1px solid #fda29b;border-radius:10px;padding:16px;margin:16px;white-space:pre-wrap">'
      + '<strong>Errore di runtime</strong>\\n\\n' + msg.replace(/</g,'&lt;') + '</div>';
  }
  window.addEventListener('error', function(ev){ showError(ev.error || ev.message); });
  window.addEventListener('unhandledrejection', function(ev){ showError(ev.reason); });
  try {
    var mod = evalModule(ENTRY);
    if (IS_REACT){
      var App = mod.default || mod.App || (typeof mod === 'function' ? mod : null);
      if (!App) throw new Error('Nessun componente React esportato di default da ' + ENTRY);
      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    }
  } catch (e){ showError(e); }
})();
`;

export function buildPreviewSrcDoc(artifact) {
  const { type, files } = artifact;
  if (type === "static" || type === "html") return inlineStatic(files);

  const jsFiles = {};
  let css = "";
  for (const [p, code] of Object.entries(files)) {
    if (p.endsWith(".css")) css += "\n" + code;
    else if (/\.(js|jsx|ts|tsx)$/.test(p)) jsFiles[p] = code;
  }
  const entry = jsFiles["/index.js"] ? "/index.js"
    : jsFiles["/App.js"] ? "/App.js"
    : jsFiles["/App.jsx"] ? "/App.jsx"
    : Object.keys(jsFiles)[0] || "/App.js";
  const isReact = type === "react" || entry === "/App.js" || entry === "/App.jsx";

  const head =
    '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>' +
    '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>' +
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>';

  const config =
    "var FILES = " + JSON.stringify(jsFiles) + ";\n" +
    "var ENTRY = " + JSON.stringify(entry) + ";\n" +
    "var IS_REACT = " + JSON.stringify(isReact) + ";\n";

  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
    "<style>html,body{margin:0}body{font-family:system-ui,-apple-system,sans-serif}" + css + "</style>" +
    head +
    "</head><body><div id='root'></div>" +
    "<script>" + config + RUNTIME + "</script>" +
    "</body></html>"
  );
}
