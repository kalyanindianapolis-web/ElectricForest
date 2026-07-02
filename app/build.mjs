// Build: HappyForest2026.jsx  ->  dist/index.html (a single self-contained file)
// Recreated from README-build.md: preamble (Supabase client + window.storage shim)
// -> transpile JSX with the TypeScript compiler -> bake into index.html with the
// 🌲 splash, CDN libs (React 18 UMD, ReactDOM 18 UMD, supabase-js v2), fonts, boot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "HappyForest2026.jsx");
const OUTDIR = path.join(ROOT, "dist");
const OUT = path.join(OUTDIR, "index.html");

const SUPABASE_URL = "https://dhaiycaywuqvjxmgzwtj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZbL4v6-8mffWsRDB-BC5bg_MXeNkutO"; // public by design

let src = fs.readFileSync(SRC, "utf8");

// 1) Strip the bare `import React, {hooks} from "react"` — React/ReactDOM are UMD globals.
src = src.replace(/^\s*import\s+React\s*,\s*\{([^}]*)\}\s*from\s*["']react["'];?\s*$/m,
  (_m, hooks) => `const { ${hooks.trim()} } = React;`);
// 2) Make the default export a plain top-level function we can render.
src = src.replace(/export\s+default\s+function\s+HappyForest/, "function HappyForest");

// 3) Transpile JSX -> JS (classic runtime: React.createElement, React in scope).
const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.ESNext,
  },
  fileName: "HappyForest2026.tsx",
});

// 4) The window.storage shim (the only thing between the app and Supabase). From HANDOFF §7.
const PREAMBLE = `
const SB = window.supabase.createClient(${JSON.stringify(SUPABASE_URL)}, ${JSON.stringify(SUPABASE_ANON_KEY)});
const localGet = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : { key:k, value:v }; } catch { return null; } };
const localSet = (k,v) => { try { localStorage.setItem(k, v); } catch {} return { key:k, value:v }; };
const localDel = (k) => { try { localStorage.removeItem(k); } catch {} return { key:k, deleted:true }; };
const localList = (p) => { const keys=[]; try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(p)) keys.push(k);} } catch {} return { keys }; };
const localListFull = (p) => { const items=[]; try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(p)) items.push({ key:k, value:localStorage.getItem(k) });} } catch {} return { items }; };
window.storage = {
  async get(key, shared){ if(shared===false) return localGet(key);
    const { data, error } = await SB.from("kv").select("value").eq("key", key).maybeSingle();
    if(error||!data) return null; return { key, value:data.value }; },
  async set(key, value, shared){ if(shared===false) return localSet(key, value);
    const { error } = await SB.from("kv").upsert({ key, value, updated_at:new Date().toISOString() });
    if(error) throw error; return { key, value }; },
  async delete(key, shared){ if(shared===false) return localDel(key);
    const { error } = await SB.from("kv").delete().eq("key", key); if(error) throw error; return { key, deleted:true }; },
  async list(prefix, shared){ if(shared===false) return localList(prefix);
    const { data, error } = await SB.from("kv").select("key").like("key", prefix+"%");
    if(error||!data) return { keys:[] }; return { keys:data.map(r=>r.key) }; },
  async listFull(prefix, shared){ if(shared===false) return localListFull(prefix);
    const { data, error } = await SB.from("kv").select("key,value").like("key", prefix+"%");
    if(error||!data) return { items:[] }; return { items:data }; },
};
`;

const BOOT = `
// Native shell wiring — only does anything inside the Capacitor app; harmless in a browser.
function __native(){
  var Cap = window.Capacitor; if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};
  try { if (P.StatusBar){ P.StatusBar.setStyle({ style: "DARK" }); if (P.StatusBar.setBackgroundColor) P.StatusBar.setBackgroundColor({ color: "#10210a" }); P.StatusBar.setOverlaysWebView && P.StatusBar.setOverlaysWebView({ overlay: false }); } } catch(e){}
  try { if (P.SplashScreen) setTimeout(function(){ P.SplashScreen.hide(); }, 80); } catch(e){}
  // light haptic on every button press — the single biggest "feels native" tweak
  try {
    if (P.Haptics) document.addEventListener("pointerdown", function(ev){
      var b = ev.target && ev.target.closest && ev.target.closest("button,.tab,.chip,.orb,.save-btn");
      if (b) { try { P.Haptics.impact({ style: "LIGHT" }); } catch(e){} }
    }, { passive: true });
  } catch(e){}
  // Android hardware back: close an open overlay/modal first, else let the app decide.
  try {
    if (P.App) P.App.addListener("backButton", function(){
      var closer = document.querySelector(".crewmap__top button, .sheet__close, .modal [data-close]");
      if (closer) { closer.click(); }
      else if (window.history.length > 1) { window.history.back(); }
      else { P.App.minimizeApp && P.App.minimizeApp(); }
    });
  } catch(e){}
}
function __boot(){
  try {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(HappyForest));
    var s = document.getElementById("splash"); if (s) s.remove();
    __native();
  } catch (e) {
    document.getElementById("root").innerHTML =
      '<pre style="color:#ffb;padding:16px;white-space:pre-wrap">Boot error: '+(e&&e.message||e)+'</pre>';
    console.error(e);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", __boot); else __boot();
`;

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#10210a" />
<title>Happy Forest! 2026</title>
<link rel="manifest" href="manifest.webmanifest" />
<link rel="preconnect" href="https://unpkg.com" />
<link rel="preconnect" href="https://cdn.jsdelivr.net" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Quicksand:wght@400;600;700&display=swap" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body{margin:0;background:#10210a;color:#eaffea;font-family:Quicksand,-apple-system,BlinkMacSystemFont,sans-serif}
  /* --- native feel: kill web-isms so it doesn't feel like a browser --- */
  html{ -webkit-text-size-adjust:100%; }
  body{ overscroll-behavior:none; -webkit-tap-highlight-color:transparent;
    -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;
    overflow-x:hidden; }
  /* let people select/edit where it matters */
  input,textarea,[contenteditable],.selectable{ -webkit-user-select:text; user-select:text; -webkit-touch-callout:default; }
  /* prevent iOS auto-zoom on focus (needs >=16px) is handled per-field; smooth momentum scroll */
  *{ -webkit-overflow-scrolling:touch; }
  button{ -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
  #splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#10210a;z-index:9999;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
  #splash .tree{font-size:64px;animation:splashpulse 1.8s ease-in-out infinite}
  #splash .t{font-family:Anton,sans-serif;letter-spacing:1px;font-size:26px;color:#d6ff4a}
  #splash .s{opacity:.7;font-size:13px}
  @keyframes splashpulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.08);opacity:1}}
</style>
</head>
<body>
<div id="splash"><div class="tree">🌲</div><div class="t">Happy Forest! 2026</div><div class="s">Waking the Forest… first visit can take a few seconds</div></div>
<div id="root"></div>
<script defer src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script defer src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script defer>
window.addEventListener("DOMContentLoaded", function(){
${PREAMBLE}
${outputText}
${BOOT}
});
</script>
</body>
</html>
`;

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, HTML, "utf8");
// copy static assets into dist
for (const f of ["manifest.webmanifest", "full-map.jpg", "venue-map.jpg", "icon-192.png", "icon-512.png"]) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(OUTDIR, f));
}
console.log("Built", OUT, "(", (HTML.length/1024).toFixed(0), "KB )");
