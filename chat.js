import { marked } from "./md/marked.esm.js";
import DOMPurify from "./md/purify.es.mjs";
const API = "https://preset-ai-chat.vercel.app/api/chat";
const $ = s => document.querySelector(s), log = $("#log"), q = $("#q"), send = $("#send"), status = $("#status");
marked.setOptions({ gfm: true, breaks: true });
const SYS = "You are WrenbyAI, a friendly, coding-first AI assistant. Help with code, questions and anything else. Use markdown (headings, lists, tables, fenced code blocks with a language). Keep prose short. Use web search for anything current and cite sources as [title](url). Don't invent URLs. Never name or hint at the underlying model or provider; if asked, you are WrenbyAI.";
let history = [], busy = false, ctrl = null, tier = localStorage.getItem("wrenby-tier") || "spark";
const tsel = $("#tier"); tsel.value = tier; const hint = () => $("#tierhint").textContent = tier === "zenith" ? "uses the most usage" : "";
tsel.onchange = () => { tier = tsel.value; localStorage.setItem("wrenby-tier", tier); hint(); }; hint();
const MAXT = { spark: 6144, turbo: 24576, forge: 49152, zenith: 73728 };
function enhance(el) { el.querySelectorAll("pre").forEach(pre => { const code = pre.querySelector("code"); if (code && window.hljs) try { hljs.highlightElement(code); } catch {}
  const b = document.createElement("button"); b.className = "codecopy"; b.type = "button"; b.textContent = "Copy";
  b.onclick = async () => { try { await navigator.clipboard.writeText(code ? code.innerText : pre.innerText); b.textContent = "Copied"; } catch { b.textContent = "Failed"; } setTimeout(() => b.textContent = "Copy", 1200); }; pre.appendChild(b); });
  el.querySelectorAll("a").forEach(a => { a.target = "_blank"; a.rel = "noopener"; }); }
const md = (el, t, fin) => { el.classList.add("md"); el.innerHTML = DOMPurify.sanitize(marked.parse(t || "")); if (fin) enhance(el); log.scrollTop = 1e9; };
function add(who, text) { const d = document.createElement("div"); d.className = "msg " + who;
  d.innerHTML = `<div class="av">${who === "u" ? "You" : '<img src="favicon.svg" alt="WrenbyAI" style="width:24px;height:24px;border-radius:5px">'}</div><div class="bub"></div>`;
  log.appendChild(d); const b = d.querySelector(".bub"); if (text != null) { if (who === "u") b.textContent = text; else md(b, text, true); } log.scrollTop = 1e9; return b; }
const hello = () => add("a", "Hi, I'm WrenbyAI. Ask me anything, or tell me what we're building.");
const MASCOT = '<span class="wl">you</span><div class="mtrack" data-dir="left"><svg class="mob" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><g class="bob"><g class="mbody"><rect class="skin" x="3" y="2" width="10" height="9"></rect><rect class="eye" x="8" y="4" width="2" height="2"></rect><rect class="eye" x="11" y="4" width="1" height="2"></rect></g><rect class="leg l1" x="4" y="11" width="3" height="3"></rect><rect class="leg l2" x="9" y="11" width="3" height="3"></rect></g></svg></div><span class="wl">web</span>';
function thinkBox(bub) { const t = document.createElement("details"); t.className = "think";
  t.innerHTML = '<summary><span class="tdot"></span><span class="tlabel">Thinking</span><span class="ttime"></span><span class="tchev">▾</span></summary><div class="steps"></div><div class="treason md" hidden></div>';
  t.open = true; const walk = document.createElement("div"); walk.className = "walk"; walk.innerHTML = MASCOT; t.appendChild(walk); const mtrack = walk.querySelector(".mtrack"); let dirT = null, ans = false;
  bub.appendChild(t); const t0 = Date.now(), tm = t.querySelector(".ttime"), iv = setInterval(() => tm.textContent = Math.round((Date.now() - t0) / 1000) + "s", 500);
  return { el: t, toWeb() { clearTimeout(dirT); mtrack.dataset.dir = "right"; dirT = setTimeout(() => { if (!ans) mtrack.dataset.dir = "left"; }, 1800); }, steps: t.querySelector(".steps"), reason: t.querySelector(".treason"),
    done() { ans = true; clearInterval(iv); t.classList.add("done"); t.open = false; t.querySelector(".tlabel").textContent = "Thought for " + Math.max(1, Math.round((Date.now() - t0) / 1000)) + "s"; tm.textContent = ""; } }; }
async function ask(text) {
  busy = true; send.textContent = "Stop"; status.textContent = "Thinking…"; add("u", text);
  const bub = add("a"); const th = thinkBox(bub); const out = document.createElement("div"); bub.appendChild(out);
  history.push({ role: "user", content: text }); ctrl = new AbortController();
  let content = "", reasoning = "", thinkDone = false; const endThink = () => { if (!thinkDone) { thinkDone = true; th.done(); } };
  try {
    const res = await fetch(API, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: SYS }, ...history.slice(-40)], max_tokens: MAXT[tier], tier }) });
    if (!res.ok) { let m = res.status; try { m = (await res.json()).error || m; } catch {} throw new Error(res.status === 429 ? "You're sending messages too fast. Try again in a minute." : String(m)); }
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf("\n\n")) >= 0) { const ev = buf.slice(0, i).trim(); buf = buf.slice(i + 2); if (!ev.startsWith("data:")) continue; const d = ev.slice(5).trim(); if (d === "[DONE]") continue;
        let j; try { j = JSON.parse(d); } catch { continue; }
        if (j.type === "search") { th.toWeb(); const s = document.createElement("div"); s.className = "step"; s.textContent = "Searched the web · " + j.count + " result" + (j.count === 1 ? "" : "s"); th.steps.appendChild(s); continue; }
        if (j.reasoning) { reasoning += j.reasoning; th.reason.hidden = false; md(th.reason, reasoning); }
        if (j.content) { endThink(); status.textContent = "Writing…"; content += j.content; md(out, content); } } }
    endThink(); md(out, content || "_(no reply)_", true); history.push({ role: "assistant", content });
  } catch (e) { endThink(); if (e.name === "AbortError") { md(out, (content ? content + "\n\n" : "") + "_Stopped._", true); if (content) history.push({ role: "assistant", content }); }
    else { history.pop(); const w = document.createElement("div"); w.className = "warn"; w.textContent = "Couldn't reach WrenbyAI: " + e.message; out.appendChild(w); } }
  busy = false; ctrl = null; send.textContent = "Send"; status.textContent = "Ready"; q.focus(); }
$("#f").onsubmit = e => { e.preventDefault(); if (busy) { ctrl?.abort(); return; } const t = q.value.trim(); if (!t) return; q.value = ""; ask(t); };
$("#reset").onclick = () => { ctrl?.abort(); history = []; log.innerHTML = ""; hello(); };
hello(); q.focus();
