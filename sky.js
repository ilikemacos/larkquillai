// Sky backdrop: a soft three-stop gradient that follows the local time of day (dawn, day, golden hour, dusk,
// night), blended smoothly between keyframes and refreshed every few minutes. Also sets --sky-ink so text that
// sits straight on the sky (header, footer) stays readable after dark.
const K = [ // hour, top, middle, bottom
  [0,    "#141a33", "#252b52", "#40406a"],
  [5,    "#1f2a4d", "#4c4f7e", "#8a6f8f"],
  [6.5,  "#8d9cc9", "#d9aeb4", "#f4c19c"],
  [8.5,  "#8db0de", "#b9cfee", "#e6edf8"],
  [15.5, "#93b3dc", "#c3d4ee", "#ece8f2"],
  [18,   "#97a0c3", "#dca995", "#f29a68"],
  [19.5, "#5b5f8e", "#a1789a", "#e2876a"],
  [21,   "#20284a", "#363b68", "#5b5078"],
  [24,   "#141a33", "#252b52", "#40406a"],
];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return "rgb(" + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",") + ")"; };
const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export function skyAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  let i = 0; while (i < K.length - 2 && h >= K[i + 1][0]) i++;
  const [h0, ...a] = K[i], [h1, ...b] = K[i + 1], t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  return a.map((c, j) => mix(c, b[j], t));
}
function paint() {
  const [t, m, b] = skyAt(), r = document.documentElement.style;
  r.setProperty("--sky1", t); r.setProperty("--sky2", m); r.setProperty("--sky3", b);
  const dark = (lum(t) + lum(m)) / 2 < 0.45;
  r.setProperty("--sky-ink", dark ? "rgba(255,255,255,.92)" : "#1b1a24");
  r.setProperty("--sky-ink-soft", dark ? "rgba(255,255,255,.62)" : "rgba(27,26,36,.55)");
  document.documentElement.classList.toggle("wy-sky-night", dark);
}
let started = false;
export function startSky() {
  if (started) return; started = true;
  document.documentElement.classList.add("wy-sky", "wy-inv");
  paint(); setInterval(paint, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) paint(); });
}
