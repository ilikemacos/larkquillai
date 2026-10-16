// Settings → General for the GitHub Pages site (the full Settings lives in the Vercel/desktop app).
// Same per-user prefs as there: wy.static { on, shimmer, chunky } and wy.inv.
import { staticPrefs, setStaticPrefs, isInverted, setInverted } from "./static.js";
import { getCompanion, setCompanion, COMPANIONS } from "./companion.js";
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
  const p = staticPrefs();
  b.append(el("h2", "", "General"), el("p", "sub", "How WrenbyAI looks."),
    (() => { const seg = el("div", "seg"); for (const [c, n] of Object.entries(COMPANIONS)) { const x = el("button", getCompanion() === c ? "on" : "", n); x.type = "button"; x.onclick = () => { setCompanion(c); seg.querySelectorAll("button").forEach(y => y.classList.toggle("on", y === x)); }; seg.append(x); }
      return row("Companion", "Who keeps you company while WrenbyAI works: Wrenby, or Milyy and her ball. Saved to your account.", seg); })(),
    row("Pixel background", "The moving pixel static at the edges. Off keeps a plain background; clicking the background still inverts.", sw(p.on !== false, v => setStaticPrefs({ on: v }))),
    row("Inverted theme", "White background, black squares. You can also click the empty background.", sw(isInverted(), v => setInverted(v))),
    row("Shimmer", "Squares flicker slowly. Off keeps the static still.", sw(p.shimmer, v => setStaticPrefs({ shimmer: v }))),
    row("Chunky squares", "Twice the square size.", sw(p.chunky, v => setStaticPrefs({ chunky: v }))));
  dlg.append(x, b); document.body.append(dlg); dlg.addEventListener("close", () => dlg.remove()); dlg.showModal();
}
export function initSettings() {
  const header = document.querySelector("header"); if (!header || document.getElementById("wy-gear")) return;
  const g = el("button", "", "⚙"); g.id = "wy-gear"; g.type = "button"; g.title = "Settings (Ctrl+,)"; g.setAttribute("aria-label", "Settings"); g.onclick = () => openSettings();
  header.append(g);
  addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); openSettings(); } });
}
