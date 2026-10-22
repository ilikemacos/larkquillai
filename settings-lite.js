// Settings → General for the GitHub Pages site (the full Settings lives in the Vercel/desktop app).
// Same per-user prefs as there: wy.inv (the pixel background and its prefs were removed).
import { isInverted, setInverted, SKY } from "./static.js";
import { getCompanion, setCompanion, COMPANIONS } from "./companion.js";
import { openUpgrade } from "./chatkit.js";
// Share approximate location (rough city from the server's IP lookup) with the model. On by default; when off, chat requests carry no_location: true (date and time are still sent).
export const getShareLocation = () => localStorage.getItem("lq.shareLocation") !== "0";
export const setShareLocation = v => localStorage.setItem("lq.shareLocation", v ? "1" : "0");
(() => { if (window.__lqLocPatch) return; window.__lqLocPatch = true; const of = window.fetch.bind(window);
  window.fetch = (input, init) => { try { const u = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
    if (!getShareLocation() && init && typeof init.body === "string" && /\/api\/chat$/.test(u.split(/[?#]/)[0])) {
      const j = JSON.parse(init.body); if (j && typeof j === "object" && !Array.isArray(j)) { j.no_location = true; init = { ...init, body: JSON.stringify(j) }; } } } catch {}
    return of(input, init); }; })();
const PN = { hobby: "Hobby", pro: "Pro", max: "Max" }, PM = { hobby: "Quill Wren 1.2 and Quill Scribe 1.1", pro: "Quill Wren 1.2, Quill Scribe 1.1 and Quill Sage 1.5", max: "Every model, including Quill Sovereign 0.5" };
// Current plan (Hobby when signed out), from the LarkquillAI backend.
async function planRow() { const pb = el("button", "pri", "See plans"); pb.type = "button"; const r = row("Plan", "Loading…", pb); const d = r.querySelector(".d"), t = r.querySelector(".t");
  let plan = "hobby"; pb.onclick = () => openUpgrade(plan === "pro" ? "max" : null);
  try { const tok = localStorage.getItem("wy.token"); const x = await fetch("https://larkquillai.vercel.app/api/billing?action=plan", { headers: tok ? { authorization: "Bearer " + tok } : {} });
    if (x.ok) { plan = (await x.json()).plan || "hobby"; d.textContent = PM[plan] + ". One-time purchase, tied to your account."; } else { d.textContent = "Quill Wren 1.2 and Quill Scribe 1.1. Sign in and upgrade for Quill Sage 1.5 and Quill Sovereign 0.5."; } }
  catch { d.textContent = "Couldn't load your plan."; }
  t.textContent = "Plan: LarkquillAI " + PN[plan]; pb.textContent = plan === "max" ? "See plans" : plan === "pro" ? "Upgrade to Max" : "Upgrade"; return r; }
const CSS = `.wy-sl{padding:0;border:1px solid #262626;border-radius:18px;background:#0e0e0e;color:#ececec;width:min(520px,94vw)}
.wy-sl::backdrop{background:#000a}.wy-sl .b{padding:22px 26px}.wy-sl h2{font-size:18px;margin:0 0 2px}.wy-sl .sub{color:#8a8a8a;font-size:13px;margin:0 0 8px}
.wy-sl .row{display:flex;align-items:center;gap:16px;padding:13px 0;border-bottom:1px solid #1b1b1b}.wy-sl .l{flex:1}.wy-sl .t{font-size:13px}.wy-sl .d{font-size:12px;color:#7d7d7d}
.wy-sl .sw{all:unset;cursor:pointer;width:38px;height:22px;border-radius:999px;background:#2a2a2a;position:relative;flex:none}.wy-sl .sw:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#888;transition:left .15s}
.wy-sl .sw.on{background:#f2f2f2}.wy-sl .sw.on:after{left:19px;background:#111}.wy-sl .x{position:absolute;top:12px;right:12px;height:30px;width:30px;border-radius:999px;padding:0}
.wy-sl .seg{display:inline-flex;border:1px solid #2c2c2c;border-radius:999px;overflow:hidden}.wy-sl .seg button{all:unset;cursor:pointer;padding:6px 14px;font-size:12px;color:#aaa}.wy-sl .seg button.on{background:#f2f2f2;color:#111}
html.wy-inv .wy-sl{filter:invert(1) hue-rotate(180deg)}`;
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };
function sw(v, f) { const b = el("button", "sw" + (v ? " on" : "")); b.type = "button"; b.setAttribute("role", "switch"); b.setAttribute("aria-checked", v); b.onclick = () => { v = !v; b.classList.toggle("on", v); b.setAttribute("aria-checked", v); f(v); }; return b; }
function row(t, d, c) { const r = el("div", "row"), l = el("div", "l"); l.append(el("div", "t", t), el("div", "d", d)); r.append(l, c); return r; }
export function openSettings() {
  if (!document.getElementById("wy-sl-css")) { const s = el("style"); s.id = "wy-sl-css"; s.textContent = CSS; document.head.append(s); }
  const dlg = el("dialog", "wy-sl"), b = el("div", "b"), x = el("button", "x", "✕"); x.onclick = () => dlg.close(); dlg.style.position = "relative";
  b.append(el("h2", "", "General"), el("p", "sub", "How LarkquillAI looks."),
    (() => { const seg = el("div", "seg"); for (const [c, n] of Object.entries(COMPANIONS)) { const x = el("button", getCompanion() === c ? "on" : "", n); x.type = "button"; x.onclick = () => { setCompanion(c); seg.querySelectorAll("button").forEach(y => y.classList.toggle("on", y === x)); }; seg.append(x); }
      return row("Companion", "Who keeps you company while LarkquillAI works: Larkquill, or Milyy and her ball. Saved to your account.", seg); })(),
    (() => { const ph = el("div"); planRow().then(r => ph.replaceWith(r)); return ph; })(),
    (() => { const ak = el("button", "", "API keys"); ak.type = "button"; ak.className = "pri"; ak.onclick = () => window.open(new URL("api.html", location.href).href, "_blank", "noopener");
      return row("API keys", "Create and manage keys for the LarkquillAI developer API, and read the docs.", ak); })(),
    row("Share approximate location", "Lets the model use your rough city for questions like \"near me\" or local weather. Off: only your date and time are shared.", sw(getShareLocation(), v => setShareLocation(v))),
    ...(SKY ? [] : [row("Inverted theme", "Light background. You can also click the empty background.", sw(isInverted(), v => setInverted(v)))]));
  dlg.append(x, b); document.body.append(dlg); dlg.addEventListener("close", () => dlg.remove()); dlg.showModal();
}
export function initSettings() {
  const header = document.querySelector("header"); if (!header || document.getElementById("wy-gear")) return;
  const g = el("button", "", "⚙"); g.id = "wy-gear"; g.type = "button"; g.title = "Settings (Ctrl+,)"; g.setAttribute("aria-label", "Settings"); g.onclick = () => openSettings();
  header.append(g);
  addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); openSettings(); } });
}
