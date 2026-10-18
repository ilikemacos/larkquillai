// Shared: virtual filesystem (IndexedDB), streaming API client, agent loop with create_file.
export const API = "https://preset-ai-chat.vercel.app/api/chat";
export const IDENTITY = "Never name or hint at the underlying model or provider; if asked, you are WrenbyAI.";
// ---------- VFS ----------
const DB = "wrenby-vfs", ST = "kv";
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbGet(k) { const d = await idb(); return new Promise(r => { const q = d.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(undefined); }); }
async function idbSet(k, v) { const d = await idb(); return new Promise(r => { const t = d.transaction(ST, "readwrite"); t.objectStore(ST).put(v, k); t.oncomplete = r; t.onerror = r; }); }
export const norm = p => { const out = []; for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); } return "/" + out.join("/"); };
export const resolve = (cwd, p) => norm(p.startsWith("/") ? p : cwd + "/" + p);
export const vfs = {
  files: new Map(), dirs: new Set(["/"]), listeners: new Set(),
  async load() { try { const v = await idbGet("fs"); if (v) { this.files = new Map(v.files); this.dirs = new Set(v.dirs); } } catch {} this.emit(); },
  save() { clearTimeout(this._t); this._t = setTimeout(() => idbSet("fs", { files: [...this.files], dirs: [...this.dirs] }).catch(() => {}), 150); this.emit(); },
  emit() { for (const f of this.listeners) try { f(); } catch {} },
  isDir(p) { return this.dirs.has(p); }, isFile(p) { return this.files.has(p); },
  mkdirp(p) { const parts = norm(p).split("/").filter(Boolean); let c = ""; for (const s of parts) { c += "/" + s; if (this.files.has(c)) throw new Error(c + ": is a file"); this.dirs.add(c); } },
  write(p, data) { p = norm(p); if (this.dirs.has(p)) throw new Error(p + ": is a directory"); this.mkdirp(p.slice(0, p.lastIndexOf("/")) || "/"); this.files.set(p, String(data)); this.save(); return p; },
  read(p) { p = norm(p); if (!this.files.has(p)) throw new Error(p + ": no such file"); return this.files.get(p); },
  list(p) { p = norm(p); if (!this.dirs.has(p)) throw new Error(p + ": no such directory"); const pre = p === "/" ? "/" : p + "/", out = new Map();
    for (const d of this.dirs) if (d !== p && d.startsWith(pre)) { const n = d.slice(pre.length).split("/")[0]; out.set(n, "d"); }
    for (const f of this.files.keys()) if (f.startsWith(pre)) { const r = f.slice(pre.length); const n = r.split("/")[0]; if (!out.has(n)) out.set(n, r.includes("/") ? "d" : "f"); }
    return [...out].sort((a, b) => a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] === "d" ? -1 : 1); },
  under(p) { p = norm(p); const pre = p === "/" ? "/" : p + "/"; return [...this.files.keys()].filter(f => f === p || f.startsWith(pre)); },
  rm(p, rec) { p = norm(p); if (this.files.delete(p)) return this.save(); if (!this.dirs.has(p) || p === "/") throw new Error(p + ": no such file or directory");
    const pre = p + "/"; const kids = this.under(p).length + [...this.dirs].filter(d => d.startsWith(pre)).length; if (kids && !rec) throw new Error(p + ": is a directory (use rm -r)");
    for (const f of this.under(p)) this.files.delete(f); for (const d of [...this.dirs]) if (d === p || d.startsWith(pre)) this.dirs.delete(d); this.save(); },
  cp(a, b, move) { a = norm(a); b = norm(b); if (this.dirs.has(b)) b = norm(b + "/" + a.split("/").pop());
    if (this.files.has(a)) { this.write(b, this.files.get(a)); if (move) this.files.delete(a); return this.save(); }
    if (!this.dirs.has(a)) throw new Error(a + ": no such file or directory"); const pre = a + "/";
    for (const d of [...this.dirs]) if (d === a || d.startsWith(pre)) this.dirs.add(b + d.slice(a.length));
    for (const f of this.under(a)) { this.files.set(b + f.slice(a.length), this.files.get(f)); if (move) this.files.delete(f); }
    if (move) for (const d of [...this.dirs]) if (d === a || d.startsWith(pre)) this.dirs.delete(d); this.save(); },
};
// ---------- downloads ----------
export function downloadBlob(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
export const downloadText = (name, text) => downloadBlob(name.split("/").pop(), new Blob([text], { type: "text/plain" }));
export function zipFiles(list, name = "wrenbyai-files.zip") { const enc = new TextEncoder(), o = {}; for (const f of list) o[f.name.replace(/^\/+/, "")] = enc.encode(f.content);
  downloadBlob(name, new Blob([window.fflate.zipSync(o)], { type: "application/zip" })); }
// ---------- API ----------
export const CREATE_FILE = { type: "function", function: { name: "create_file", description: "Create or overwrite a file for the user to download. Always pass the COMPLETE file content.", parameters: { type: "object", properties: { filename: { type: "string", description: "relative path, e.g. app.js or src/main.py" }, content: { type: "string" } }, required: ["filename", "content"] } } };
export async function streamOnce(body, on = {}, signal) {
  const tok = typeof localStorage !== "undefined" && localStorage.getItem("wy.token");
  const res = await fetch(API, { method: "POST", signal, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(body) });
  if (!res.ok) { let m = res.status, code; try { const j = await res.json(); m = j.error || m; code = j.code; } catch {}
    const e = new Error(code === "token_limit" || code === "quota_limit" || (res.status === 429 && code) ? String(m) : res.status === 429 ? "Too many messages. Try again in a minute." : String(m)); e.code = code; e.status = res.status; throw e; }
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "", content = "", reasoning = "", err = null; const tc = [];
  for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf("\n\n")) >= 0) { const ev = buf.slice(0, i).trim(); buf = buf.slice(i + 2); if (!ev.startsWith("data:")) continue; const d = ev.slice(5).trim(); if (d === "[DONE]") continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      if (j.type === "search") { on.search?.(j); continue; }
      if (j.type === "quota") { on.quota?.(j); continue; }
      if (j.type === "notice") { on.notice?.(j); continue; }
      if (j.error) { err = j; continue; }
      if (j.reasoning) { reasoning += j.reasoning; on.reasoning?.(reasoning, j.reasoning); }
      if (j.content) { content += j.content; on.content?.(content, j.content); }
      for (const t of j.tool_calls || []) { const k = t.index ?? tc.length; tc[k] ||= { id: "", type: "function", function: { name: "", arguments: "" } };
        if (t.id) tc[k].id = t.id; if (t.function?.name) tc[k].function.name += t.function.name; if (t.function?.arguments) tc[k].function.arguments += t.function.arguments; } } }
  tc.forEach((c, i) => { if (c && !c.id) c.id = "call_" + i; });
  // never return silently empty: surface the server's no-answer event, or a stream that just ended empty
  if (!content.trim() && !tc.some(c => c?.function?.name)) { const e = new Error(err?.error || "WrenbyAI didn't send an answer this time. Please try again."); e.code = "no_answer"; e.reason = err?.reason || "empty"; throw e; }
  return { content, reasoning, tool_calls: tc.filter(c => c?.function?.name) }; }
// Agent loop: runs create_file calls via onFile(name, content) -> path. Returns final text + files.
export async function runAgent(messages, { tier = "spark", maxTokens = 6144, on = {}, onFile, signal, noSearch } = {}) {
  const msgs = [...messages], files = []; let text = "";
  // GLM 5.3 Flash / Wrenby Code and image messages: one request per message (each counts against a daily quota), no tools
  const single = tier === "flash" || tier === "code" || msgs.some(m => Array.isArray(m.content));
  for (let step = 0; step < (single ? 1 : 6); step++) {
    const req = () => streamOnce({ messages: msgs, tools: single ? undefined : [CREATE_FILE], max_tokens: maxTokens, tier, no_search: noSearch || step > 0 }, { ...on, content: (c, d) => on.content?.(text + c, d) }, signal);
    let r; try { r = await req(); } catch (e) { if (e.code !== "no_answer" || e.reason === "length" || e.reason === "timeout") throw e; on.retry?.(); r = await req(); } // one retry when the service went quiet
    text += r.content;
    if (!r.tool_calls.length) break;
    msgs.push({ role: "assistant", content: r.content || null, tool_calls: r.tool_calls });
    for (const c of r.tool_calls) { let a = {}; try { a = JSON.parse(c.function.arguments || "{}"); } catch {}
      let res; if (c.function.name === "create_file" && a.filename && typeof a.content === "string") { const p = onFile ? await onFile(a.filename, a.content) : a.filename; files.push({ name: p, content: a.content }); on.file?.(p, a.content); res = { ok: true, file: p, bytes: a.content.length }; }
      else res = { ok: false, error: "bad arguments or unknown tool" };
      msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(res) }); }
    if (text && !text.endsWith("\n")) { text += "\n\n"; }
  }
  return { text, files }; }
// fenced code blocks with a filename: ```js app.js | ```js title="app.js" | a **app.js** / `app.js` line right before the fence
export function fencedFiles(md) { const out = []; const re = /(?:^|\n)(?:(?:#+ *|\*\*|`)?([\w.\/-]+\.[A-Za-z0-9]+)(?:\*\*|`)?:?[ \t]*\n)?```([\w+#-]*)(?:[ \t]+(?:title=|file(?:name)?=)?["']?([\w.\/-]+\.[A-Za-z0-9]+)["']?)?[^\n]*\n([\s\S]*?)\n```/g; let m, n = 0;
  while ((m = re.exec(md))) { const name = m[3] || m[1]; const code = m[4]; n++;
    if (name) out.push({ name, lang: m[2], content: code + "\n" }); else if (code.split("\n").length >= 15) out.push({ name: "snippet-" + n + "." + (EXT[m[2]] || m[2] || "txt"), lang: m[2], content: code + "\n" }); }
  return out; }
const EXT = { javascript: "js", js: "js", typescript: "ts", python: "py", py: "py", html: "html", css: "css", json: "json", bash: "sh", sh: "sh", shell: "sh", jsx: "jsx", tsx: "tsx", rust: "rs", go: "go", java: "java", c: "c", cpp: "cpp", "c++": "cpp", markdown: "md", md: "md", yaml: "yml", sql: "sql", ruby: "rb", php: "php" };
export const langOf = name => { const e = (name.split(".").pop() || "").toLowerCase(); return ({ js: "JS", mjs: "JS", ts: "TS", jsx: "JSX", tsx: "TSX", py: "PY", html: "HTML", htm: "HTML", css: "CSS", json: "JSON", md: "MD", sh: "SH", rs: "RS", go: "GO", java: "JAVA", c: "C", cpp: "C++", sql: "SQL", yml: "YML", yaml: "YML", txt: "TXT" })[e] || e.toUpperCase().slice(0, 4) || "FILE"; };
export const fmtSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
