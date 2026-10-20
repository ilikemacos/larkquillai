import { marked } from "./md/marked.esm.js";
import DOMPurify from "./md/purify.es.mjs";
import { vfs, runAgent, fencedFiles, langOf, fmtSize, downloadText, zipFiles, IDENTITY, norm } from "./core.js";
import { initTerminal, toggleTerminal } from "./term.js";
import { initAuth, authInfo } from "./auth.js";
import { runCloudTask, classifyRemote, LOOSE } from "./cloudtask.js";
import { applyTheme } from "./theme.js";
import { initChatKit, renderImages, enhanceCode, QUOTA_TIERS } from "./chatkit.js";
import { onAuthChange } from "./auth.js";
let session = null;
const $ = s => document.querySelector(s), log = $("#log"), q = $("#q"), send = $("#send"), status = $("#status");
marked.setOptions({ gfm: true, breaks: true });
const SYS = `You are LarkquillAI, a friendly, coding-first AI assistant. Help with code, questions and anything else. Use markdown and keep prose short. Use web search for anything current and cite sources as [title](url); don't invent URLs.
Files: when the user asks you to make a file, script, page or project, call the create_file tool once per file with the COMPLETE content (no placeholders). The user gets a download card for each file and the files also appear in their terminal workspace. Don't repeat the file contents in your reply; just say briefly what you made. Short examples can go in fenced code blocks; put the filename after the language when it is a file, like \`\`\`js app.js. ${IDENTITY}`;
let history = [], busy = false, ctrl = null, tier = localStorage.getItem("wy.model") || localStorage.getItem("wrenby-tier") || "spark", kit = null;
const tsel = $("#tier"); tsel.value = tier; const hint = () => $("#tierhint").textContent = tier === "zenith" ? "uses the most usage" : "";
tsel.onchange = () => { tier = tsel.value; if (!QUOTA_TIERS.has(tier)) localStorage.setItem("wrenby-tier", tier); hint(); }; hint();
const MAXT = { spark: 6144, turbo: 24576, forge: 32768, zenith: 32768, flash: 16384, code: 32768 };
const hl = (code, name) => { if (!window.hljs) return; const e = (name.split(".").pop() || "").toLowerCase(); const l = { js: "javascript", mjs: "javascript", py: "python", ts: "typescript", sh: "bash", htm: "html", html: "xml", md: "markdown", yml: "yaml", rs: "rust" }[e] || e;
  try { code.innerHTML = hljs.getLanguage(l) ? hljs.highlight(code.textContent, { language: l }).value : hljs.highlightAuto(code.textContent).value; } catch {} };
function enhance(el) { el.querySelectorAll("pre").forEach(pre => { const code = pre.querySelector("code"); if (code && window.hljs) try { hljs.highlightElement(code); } catch {}
  const b = document.createElement("button"); b.className = "codecopy"; b.type = "button"; b.textContent = "Copy";
  b.onclick = async () => { try { await navigator.clipboard.writeText(code ? code.innerText : pre.innerText); b.textContent = "Copied"; } catch { b.textContent = "Failed"; } setTimeout(() => b.textContent = "Copy", 1200); }; pre.appendChild(b); });
  el.querySelectorAll("a").forEach(a => { a.target = "_blank"; a.rel = "noopener"; }); enhanceCode(el); }
const md = (el, t, fin) => { el.classList.add("md"); el.innerHTML = DOMPurify.sanitize(marked.parse(t || "")); if (fin) enhance(el); log.scrollTop = 1e9; };
function add(who, text) { const d = document.createElement("div"); d.className = "msg " + who;
  d.innerHTML = `<div class="av">${who === "u" ? "You" : '<img src="favicon.svg" alt="LarkquillAI" style="width:24px;height:24px;border-radius:5px">'}</div><div class="bub"></div>`;
  log.appendChild(d); const b = d.querySelector(".bub"); if (text != null) { if (who === "u") b.textContent = text; else md(b, text, true); } log.scrollTop = 1e9; return b; }
const hello = () => add("a", "Hi, I'm LarkquillAI. Ask me anything, or tell me what we're building.").closest(".msg").classList.add("wy-noacts");
// ---------- side viewer ----------
const viewer = $("#viewer"); let vfile = null;
function openViewer(f) { vfile = f; $("#vicon").textContent = langOf(f.name); $("#vname").textContent = f.name.replace(/^\//, ""); $("#vsize").textContent = fmtSize(new Blob([f.content]).size);
  const c = $("#vcode code"); c.textContent = f.content; hl(c, f.name); viewer.hidden = false; document.body.classList.add("viewer-open"); $("#vx").focus({ preventScroll: true }); }
function closeViewer() { viewer.hidden = true; document.body.classList.remove("viewer-open"); vfile = null; }
$("#vx").onclick = closeViewer; $("#vdl").onclick = () => vfile && downloadText(vfile.name, vfile.content);
$("#vcopy").onclick = async e => { try { await navigator.clipboard.writeText(vfile.content); e.target.textContent = "Copied"; } catch { e.target.textContent = "Failed"; } setTimeout(() => e.target.textContent = "Copy", 1200); };
// ---------- file cards ----------
function card(f) { const d = document.createElement("div"); d.className = "fcard"; const lines = f.content.split("\n"); const long = lines.length > 12;
  d.innerHTML = `<div class="fhead"><span class="ficon"></span><span class="fname"></span><span class="fsize"></span><span class="fgrow"></span>${long ? '<button class="fopen">Open</button>' : ""}<button class="primary fdl">Download</button></div><pre class="fpreview"><code></code></pre>`;
  d.querySelector(".ficon").textContent = langOf(f.name); d.querySelector(".fname").textContent = f.name.replace(/^\//, ""); d.querySelector(".fname").title = "Open in viewer";
  d.querySelector(".fsize").textContent = fmtSize(new Blob([f.content]).size) + " · " + lines.length + " line" + (lines.length === 1 ? "" : "s");
  const code = d.querySelector("code"); code.textContent = lines.slice(0, 12).join("\n") + (long ? "\n…" : ""); hl(code, f.name);
  d.querySelector(".fdl").onclick = () => downloadText(f.name, f.content); d.querySelector(".fname").onclick = d.querySelector(".fpreview").onclick = () => openViewer(f);
  if (long) d.querySelector(".fopen").onclick = () => openViewer(f); return d; }
function showFiles(bub, files) { const seen = new Map(); for (const f of files) seen.set(f.name, f); files = [...seen.values()]; if (!files.length) return;
  const box = document.createElement("div"); box.className = "files"; files.forEach(f => box.appendChild(card(f)));
  if (files.length > 1) { const z = document.createElement("button"); z.className = "zipall"; z.textContent = `Download all (${files.length} files, .zip)`; z.onclick = () => zipFiles(files.map(f => ({ name: f.name, content: f.content }))); box.appendChild(z); }
  bub.appendChild(box); log.scrollTop = 1e9; }
// ---------- thinking ----------
const MASCOT = '<span class="wl">you</span><div class="mtrack" data-dir="left"><svg class="mob" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><g class="bob"><g class="mbody"><rect class="skin" x="3" y="2" width="10" height="9"></rect><rect class="eye" x="8" y="4" width="2" height="2"></rect><rect class="eye" x="11" y="4" width="1" height="2"></rect></g><rect class="leg l1" x="4" y="11" width="3" height="3"></rect><rect class="leg l2" x="9" y="11" width="3" height="3"></rect></g></svg></div><span class="wl">web</span>';
function thinkBox(bub) { const t = document.createElement("details"); t.className = "think";
  t.innerHTML = '<summary><span class="tdot"></span><span class="tlabel">Thinking</span><span class="ttime"></span><span class="tchev">▾</span></summary><div class="steps"></div><div class="treason md" hidden></div>';
  t.open = true; const walk = document.createElement("div"); walk.className = "walk"; walk.innerHTML = MASCOT; t.appendChild(walk); const mtrack = walk.querySelector(".mtrack"); let dirT = null, ans = false;
  bub.appendChild(t); const t0 = Date.now(), tm = t.querySelector(".ttime"), iv = setInterval(() => tm.textContent = Math.round((Date.now() - t0) / 1000) + "s", 500);
  return { el: t, toWeb() { clearTimeout(dirT); mtrack.dataset.dir = "right"; dirT = setTimeout(() => { if (!ans) mtrack.dataset.dir = "left"; }, 1800); }, steps: t.querySelector(".steps"), reason: t.querySelector(".treason"),
    done() { ans = true; clearInterval(iv); t.classList.add("done"); t.open = false; t.querySelector(".tlabel").textContent = "Thought for " + Math.max(1, Math.round((Date.now() - t0) / 1000)) + "s"; tm.textContent = ""; } }; }
const step = (th, txt) => { const s = document.createElement("div"); s.className = "step"; s.textContent = txt; th.steps.appendChild(s); };
const imgNote = n => n ? `\n[${n} image${n === 1 ? "" : "s"} attached]` : "";
async function ask(text, images = [], { showUser = true } = {}) {
  busy = true; dispatchEvent(new Event("wrenby:gen-start")); status.textContent = "Thinking…";
  if (showUser) { const ub = add("u", text); const m = ub.closest(".msg"); m._raw = text; m._images = images; renderImages(ub, images); }
  const bub = add("a"); const th = thinkBox(bub); const out = document.createElement("div"); bub.appendChild(out);
  history.push({ role: "user", content: text + imgNote(images.length) }); ctrl = new AbortController(); kit?.setBusy(true, () => ctrl?.abort());
  // images ride only on this request's last user message; history keeps the text note
  const reqHist = () => { const h = history.slice(-40); if (images.length) h[h.length - 1] = { role: "user", content: [{ type: "text", text }, ...images.map(i => ({ type: "image_url", image_url: { url: i.url } }))] }; return h; };
  let content = "", reasoning = "", thinkDone = false; const endThink = () => { if (!thinkDone) { thinkDone = true; th.done(); } };
  try {
    if ((tier === "forge" || tier === "zenith") && !images.length && LOOSE.test(text)) {
      if (authInfo().user) { const ct = await runCloudTask(bub, text, tier, { signal: ctrl.signal, onStatus: s => status.textContent = s }).catch(e => { if (e.name === "AbortError") throw e; const w = document.createElement("div"); w.className = "warn"; w.textContent = "Cloud sandbox unavailable (" + e.message + "), answering in chat instead."; bub.appendChild(w); return null; });
        if (ct) { endThink(); md(out, ct.summary || (ct.status === "done" ? "Done." : "_" + ct.status + "_"), true); ct.files.forEach(f => vfs.write(norm(f.name), f.content)); showFiles(bub, ct.files);
          const reply = (ct.summary || "") + (ct.files.length ? "\n\n[Created files in cloud sandbox: " + ct.files.map(f => f.name).join(", ") + "]" : "");
          if (session) session.saveTurn({ user: text, assistant: reply, files: ct.files.length ? ct.files : null, mode: tier }).catch(() => {});
          history.push({ role: "assistant", content: reply }); busy = false; dispatchEvent(new Event("wrenby:gen-end")); ctrl = null; kit?.setBusy(false); status.textContent = "Ready"; q.focus(); return; } }
      else classifyRemote(text, tier).then(c => { if (c.hard) { const h = document.createElement("div"); h.className = "warn"; h.textContent = "Sign in to run this in a cloud sandbox (real install, build and test)."; bub.appendChild(h); } }).catch(() => {});
    }
    const r = await runAgent([{ role: "system", content: SYS }, ...reqHist()], { tier, maxTokens: MAXT[tier], signal: ctrl.signal,
      on: { search: j => (th.toWeb(), 0) || step(th, "Searched the web · " + j.count + " result" + (j.count === 1 ? "" : "s")),
        reasoning: rs => { reasoning = rs; th.reason.hidden = false; md(th.reason, rs); },
        content: c => { endThink(); status.textContent = "Writing…"; content = c; md(out, c); },
        retry: () => step(th, "No answer came back · retrying once"),
        quota: j => kit?.setQuota(j.model, j.left), notice: j => step(th, j.text),
        file: p => { step(th, "Created " + p.replace(/^\//, "")); status.textContent = "Writing files…"; } },
      onFile: (name, c) => vfs.write(norm(name), c) });
    endThink(); content = r.text; md(out, content || (r.files.length ? "" : "_(no reply)_"), true);
    const fenced = fencedFiles(content).map(f => { if (!/^snippet-/.test(f.name)) vfs.write(norm(f.name), f.content); return { name: norm(f.name), content: f.content }; });
    showFiles(bub, [...r.files, ...fenced]);
    const allFiles = [...r.files, ...fenced.filter(f => !r.files.some(x => x.name === f.name))];
    if (session) session.saveTurn({ user: text + imgNote(images.length), assistant: content, files: allFiles.length ? allFiles : null, mode: tier }).catch(() => {});
    history.push({ role: "assistant", content: content + (r.files.length ? "\n\n[Created files: " + r.files.map(f => f.name).join(", ") + "]" : "") });
  } catch (e) { endThink(); if (e.name === "AbortError") { md(out, (content ? content + "\n\n" : "") + "_Stopped._", true); if (content) history.push({ role: "assistant", content }); }
    else { history.pop(); const w = document.createElement("div"); w.className = "warn";
      const friendly = e.code && ["no_answer", "quota_limit", "signin_required", "model_unavailable", "quota_error", "bad_image", "too_large", "no_vision", "token_limit"].includes(e.code);
      w.textContent = friendly ? e.message : "Couldn't reach LarkquillAI: " + e.message; out.appendChild(w); if (e.code === "quota_limit") kit?.setQuota(tier, 0);
      if (!["quota_limit", "signin_required", "bad_image", "too_large", "token_limit"].includes(e.code)) kit?.retryButton(out, "Retry", () => regenerate()); } }
  busy = false; dispatchEvent(new Event("wrenby:gen-end")); ctrl = null; kit?.setBusy(false); status.textContent = "Ready"; q.focus(); }
const userMsgs = () => [...log.querySelectorAll(".msg.u")];
// Regenerate: drop the last reply and run the last user message again (its history entry is re-added by ask()).
function regenerate() { if (busy) return; const us = userMsgs(), u = us[us.length - 1]; if (!u) return;
  let n = u.nextElementSibling; while (n) { const x = n.nextElementSibling; n.remove(); n = x; }
  while (history.length && history[history.length - 1].role === "assistant") history.pop(); if (history.length && history[history.length - 1].role === "user") history.pop();
  ask(u._raw ?? u.querySelector(".bub").innerText, u._images || [], { showUser: false }); }
// Edit and resend: remove that message and everything after it (and matching history), then send the new text.
function editResend(m, t) { if (busy) return; const us = userMsgs(), k = us.indexOf(m); if (k < 0) return; let drop = us.length - k; const imgs = m._images || [];
  let n = m; while (n) { const x = n.nextElementSibling; n.remove(); n = x; }
  while (history.length && drop > 0) { if (history.pop().role === "user") drop--; }
  ask(t, imgs); }
$("#f").onsubmit = e => { e.preventDefault(); if (busy) { ctrl?.abort(); return; } const images = kit ? kit.takeImages() : []; let t = q.value.trim();
  if (!t && !images.length) return; if (!t) t = images.length === 1 ? "What's in this image?" : "What's in these images?"; q.value = ""; ask(t, images); };
const freshChat = () => { ctrl?.abort(); history = []; log.innerHTML = ""; closeViewer(); };
$("#reset").onclick = () => { freshChat(); hello(); session?.startNewChat(); };
function loadConversation(msgs) { freshChat(); for (const m of msgs || []) { const c = String(m.content || "");
    if (m.role === "user") { const ub = add("u", c); ub.closest(".msg")._raw = c; history.push({ role: "user", content: c }); }
    else if (m.role === "assistant") { const b = add("a", c); if (Array.isArray(m.files) && m.files.length) showFiles(b, m.files.filter(f => f && f.name && typeof f.content === "string")); history.push({ role: "assistant", content: c }); } }
  if (!log.children.length) hello(); }
initAuth({ base: "https://larkquillai.vercel.app", getMode: () => tier, onNewChat: () => { freshChat(); hello(); }, onLoadChat: msgs => loadConversation(msgs) }).then(s => session = s).catch(e => console.warn("auth init failed", e));
// ---------- terminal panel ----------
const ufile = $("#ufile");
ufile.onchange = async () => { for (const f of ufile.files) vfs.write("/" + f.name, await f.text()); ufile.value = ""; };
initTerminal({ panel: $("#panel"), host: $("#xhost"), tree: $("#xtree"), upload: () => ufile.click(), openFile: p => openViewer({ name: p, content: vfs.read(p) }) });
$("#tbtn").onclick = () => toggleTerminal(); $("#pclose").onclick = () => { toggleTerminal(false); q.focus(); }; $("#upl").onclick = () => ufile.click();
$("#zipws").onclick = () => { const fs = [...vfs.files.keys()]; if (fs.length) zipFiles(fs.map(p => ({ name: p, content: vfs.read(p) })), "workspace.zip"); };
addEventListener("keydown", e => { if (e.ctrlKey && (e.key === "`" || e.code === "Backquote")) { e.preventDefault(); if (!toggleTerminal()) q.focus(); }
  else if (e.key === "Escape" && !viewer.hidden) { e.preventDefault(); closeViewer(); } });
applyTheme(); vfs.load(); hello(); q.focus();
try { kit = initChatKit({ form: $("#f"), input: q, send, tierSelect: tsel, log, dropZone: document.querySelector("main"), apiBase: "https://larkquillai.vercel.app",
    onRegenerate: () => regenerate(), onEdit: (m, t) => editResend(m, t) });
  onAuthChange(u => kit.setUser(u && (u.id || u.email))); } catch (e) { console.warn("chat kit", e); }
