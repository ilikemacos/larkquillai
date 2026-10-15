// VS Code-style bottom panel: explorer + xterm shell over the virtual filesystem.
import { vfs, resolve, downloadText, zipFiles, runAgent, IDENTITY } from "./core.js";
const PY_BASE = "https://preset-ai-chat.vercel.app/pyodide/";
let term, fit, cwd = "/", line = "", cur = 0, hist = [], hi = 0, busy = null, opened = false, ui = {};
const C = { dim: s => `\x1b[2m${s}\x1b[0m`, acc: s => `\x1b[38;2;255;106;43m${s}\x1b[0m`, err: s => `\x1b[38;2;224;106;90m${s}\x1b[0m`, dir: s => `\x1b[38;2;130;170;255m${s}\x1b[0m` };
const out = s => term.write(String(s).replace(/\r?\n/g, "\r\n"));
const outln = s => out(s + "\n");
const prompt = () => { term.write("\r\n" + C.acc("wrenby") + " " + C.dir(cwd) + " $ "); line = ""; cur = 0; };
function args(s) { const a = []; let m; const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g; while ((m = re.exec(s))) a.push(m[1] != null ? m[1].replace(/\\(.)/g, "$1") : m[2] != null ? m[2] : m[3]); return a; }
const HELP = `Commands
  ls [dir]  cd <dir>  pwd  cat <file>  mkdir [-p] <dir>  rm [-r] <path>
  mv <a> <b>  cp <a> <b>  touch <file>  echo <text> [> file | >> file]
  clear  help  download <file>  zip [dir]  upload
  node <file.js>      run JavaScript in a sandboxed worker
  python <file.py>    run Python in the browser (loads on first use)
  wrenby "<prompt>"   ask WrenbyAI; files it creates land in this folder
Keys: Up/Down history, Tab completes, Ctrl+C cancels, Ctrl+L clears.`;
async function exec(raw) {
  let redir = null; const rm = raw.match(/^(echo\b.*?)\s(>>?)\s*(\S+)\s*$/); if (rm) { raw = rm[1]; redir = { app: rm[2] === ">>", file: rm[3] }; }
  const [cmd, ...a] = args(raw); if (!cmd) return; const P = p => resolve(cwd, p);
  switch (cmd) {
    case "help": return outln(HELP);
    case "clear": return term.clear();
    case "pwd": return outln(cwd);
    case "ls": { const d = P(a.filter(x => !x.startsWith("-"))[0] || "."); if (vfs.isFile(d)) return outln(d.split("/").pop()); const l = vfs.list(d); return outln(l.length ? l.map(([n, t]) => t === "d" ? C.dir(n + "/") : n).join("  ") : C.dim("(empty)")); }
    case "cd": { const d = P(a[0] || "/"); if (!vfs.isDir(d)) throw new Error("cd: " + d + ": no such directory"); cwd = d; return; }
    case "cat": if (!a.length) throw new Error("cat: missing file"); for (const f of a) outln(vfs.read(P(f)).replace(/\n$/, "")); return;
    case "mkdir": for (const f of a.filter(x => x !== "-p")) vfs.mkdirp(P(f)); vfs.save(); return;
    case "touch": for (const f of a) if (!vfs.isFile(P(f))) vfs.write(P(f), ""); return;
    case "rm": { const r = a.some(x => /^-\w*r/.test(x)); for (const f of a.filter(x => !x.startsWith("-"))) vfs.rm(P(f), r); return; }
    case "mv": case "cp": { const f = a.filter(x => !x.startsWith("-")); if (f.length !== 2) throw new Error(cmd + ": usage: " + cmd + " <src> <dest>"); vfs.cp(P(f[0]), P(f[1]), cmd === "mv"); return; }
    case "echo": { const t = a.join(" "); if (redir) { const p = P(redir.file); vfs.write(p, (redir.app && vfs.isFile(p) ? vfs.read(p) : "") + t + "\n"); } else outln(t); return; }
    case "download": if (!a.length) throw new Error("download: missing file"); for (const f of a) { const p = P(f); if (vfs.isDir(p)) { zipDir(p); continue; } downloadText(p, vfs.read(p)); outln(C.dim("downloaded " + p.split("/").pop())); } return;
    case "zip": return zipDir(P(a[0] || "."));
    case "upload": return ui.upload?.();
    case "node": return runNode(P(a[0] || ""), a.slice(1));
    case "python": case "python3": return runPy(P(a[0] || ""));
    case "wrenby": return ask(a.join(" "));
    default: throw new Error(cmd + ": command not found (try help)");
  } }
function zipDir(p) { const fs = vfs.under(p); if (!fs.length) throw new Error("zip: nothing to zip in " + p); const base = p === "/" ? "/" : p + "/";
  zipFiles(fs.map(f => ({ name: f.startsWith(base) ? f.slice(base.length) : f.split("/").pop(), content: vfs.read(f) })), (p === "/" ? "workspace" : p.split("/").pop()) + ".zip"); outln(C.dim(`zipped ${fs.length} file${fs.length === 1 ? "" : "s"}`)); }
function runNode(p, argv) { const code = vfs.read(p);
  const src = `const fmt=a=>a.map(x=>typeof x==="string"?x:(()=>{try{return JSON.stringify(x,null,2)}catch{return String(x)}})()).join(" ");
  const send=(k,a)=>postMessage({k,t:fmt(a)});self.console={log:(...a)=>send("o",a),info:(...a)=>send("o",a),warn:(...a)=>send("e",a),error:(...a)=>send("e",a),debug:(...a)=>send("o",a)};
  self.process={argv:["node",${JSON.stringify(p)},...${JSON.stringify(argv)}],env:{},exit:()=>{throw "__exit"}};
  self.onmessage=async()=>{try{await (async()=>{${"\n"}${code.replace(/^#!.*\n/, "")}${"\n"}})()}catch(e){if(e!=="__exit")send("e",[String(e&&e.stack||e)])}postMessage({k:"done"})};`;
  return new Promise(res => { const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" }))); const t = setTimeout(() => { w.terminate(); outln(C.err("node: timed out after 15s")); res(); }, 15000);
    busy = { cancel: () => { clearTimeout(t); w.terminate(); res(); } };
    w.onmessage = e => { const m = e.data; if (m.k === "done") { clearTimeout(t); w.terminate(); res(); } else outln(m.k === "e" ? C.err(m.t) : m.t); };
    w.onerror = e => { e.preventDefault(); clearTimeout(t); w.terminate(); outln(C.err(e.message)); res(); }; w.postMessage(0); }); }
let py; async function runPy(p) { const code = vfs.read(p);
  if (!py) { outln(C.dim("loading Python (first run only)…")); py = import(PY_BASE + "pyodide.mjs").then(m => m.loadPyodide({ indexURL: PY_BASE })); py.catch(() => py = null); }
  const pyo = await py; pyo.setStdout({ batched: s => outln(s) }); pyo.setStderr({ batched: s => outln(C.err(s)) });
  const root = "/home/pyodide/ws"; try { pyo.FS.mkdirTree(root); } catch {}
  for (const f of vfs.files.keys()) { const d = root + f.slice(0, f.lastIndexOf("/")); try { pyo.FS.mkdirTree(d); } catch {} pyo.FS.writeFile(root + f, vfs.files.get(f)); }
  pyo.FS.chdir(root + cwd);
  try { await pyo.loadPackagesFromImports(code).catch(() => {}); await pyo.runPythonAsync(code); } catch (e) { outln(C.err(String(e.message || e).trim().split("\n").slice(-6).join("\n"))); } }
async function ask(q) { if (!q) throw new Error('usage: wrenby "<prompt>"'); const ac = new AbortController(); busy = { cancel: () => ac.abort() };
  const tree = [...vfs.files.keys()].slice(0, 200).join("\n") || "(empty)";
  const sys = `You are WrenbyAI, a coding assistant answering inside a terminal. Plain text, short. When the user wants code or files, call create_file with the COMPLETE content (paths relative to the current folder ${cwd}). ${IDENTITY}\nFiles in the workspace:\n${tree}`;
  let thinking = true; out(C.dim("thinking…"));
  try { const r = await runAgent([{ role: "system", content: sys }, { role: "user", content: q }], { signal: ac.signal, noSearch: false, maxTokens: 8192,
      on: { content: (_, d) => { if (thinking) { thinking = false; out("\r\x1b[K"); } out(d); }, search: j => out(C.dim(` (searched the web · ${j.count})`)), file: p => { if (thinking) { thinking = false; out("\r\x1b[K"); } outln("\n" + C.acc("✓ wrote ") + p); } },
      onFile: (name, content) => vfs.write(resolve(cwd, name), content) });
    if (thinking) out("\r\x1b[K"); if (!r.text && !r.files.length) outln(C.dim("(no reply)"));
  } catch (e) { out("\r\x1b[K"); outln(e.name === "AbortError" ? C.dim("cancelled") : C.err("wrenby: " + e.message)); } }
function complete() { const parts = line.slice(0, cur).split(" "); const w = parts.pop(); const slash = w.lastIndexOf("/"); const dir = resolve(cwd, slash >= 0 ? w.slice(0, slash + 1) || "/" : "."), pre = w.slice(slash + 1);
  let l; try { l = vfs.list(dir); } catch { return; } const m = l.filter(([n]) => n.startsWith(pre)); if (m.length !== 1) { if (m.length > 1) { out("\r\n" + m.map(x => x[0]).join("  ")); const keep = line, c = cur; prompt(); line = keep; cur = c; term.write(line); } return; }
  const add = m[0][0].slice(pre.length) + (m[0][1] === "d" ? "/" : " "); line = line.slice(0, cur) + add + line.slice(cur); cur += add.length; term.write(add); }
function redraw() { term.write("\x1b[2K\r" + C.acc("wrenby") + " " + C.dir(cwd) + " $ " + line); const back = line.length - cur; if (back > 0) term.write(`\x1b[${back}D`); }
async function onData(d) {
  if (busy) { if (d === "\x03") { busy.cancel(); out("^C"); } return; }
  if (d === "\r") { const cmd = line.trim(); term.write("\r\n"); if (cmd) { hist.push(cmd); hi = hist.length; busy = { cancel() {} }; try { await exec(cmd); } catch (e) { outln(C.err(e.message || e)); } busy = null; } prompt(); return; }
  if (d === "\x7f") { if (cur > 0) { line = line.slice(0, cur - 1) + line.slice(cur); cur--; redraw(); } return; }
  if (d === "\x03") { term.write("^C"); prompt(); return; } if (d === "\x0c") { term.clear(); redraw(); return; } if (d === "\t") return complete();
  if (d === "\x1b[A" || d === "\x1b[B") { if (!hist.length) return; hi = Math.max(0, Math.min(hist.length, hi + (d === "\x1b[A" ? -1 : 1))); line = hist[hi] || ""; cur = line.length; return redraw(); }
  if (d === "\x1b[D") { if (cur > 0) { cur--; term.write(d); } return; } if (d === "\x1b[C") { if (cur < line.length) { cur++; term.write(d); } return; }
  if (d.startsWith("\x1b")) return;
  const t = d.replace(/[\r\n]+/g, " ").replace(/[\x00-\x1f]/g, ""); if (!t) return; line = line.slice(0, cur) + t + line.slice(cur); cur += t.length; redraw(); }
// ---------- explorer ----------
function renderTree() { const el = ui.tree; if (!el) return; el.innerHTML = ""; const walk = (dir, depth) => { for (const [n, t] of vfs.list(dir)) { const p = (dir === "/" ? "" : dir) + "/" + n; const r = document.createElement("div"); r.className = "xrow" + (t === "d" ? " xdir" : ""); r.style.paddingLeft = 8 + depth * 12 + "px"; r.textContent = (t === "d" ? "▸ " : "") + n; r.title = p;
      r.onclick = () => t === "d" ? (cwd = p, busy || redraw()) : ui.openFile?.(p); if (t === "f") { const dl = document.createElement("button"); dl.className = "xdl"; dl.textContent = "↓"; dl.title = "Download"; dl.onclick = e => { e.stopPropagation(); downloadText(p, vfs.read(p)); }; r.appendChild(dl); }
      el.appendChild(r); if (t === "d") walk(p, depth + 1); } };
  walk("/", 0); if (!el.children.length) el.innerHTML = '<div class="xempty">No files yet. Ask WrenbyAI to make one, or use upload.</div>'; }
export function initTerminal(opts) { ui = opts; vfs.listeners.add(renderTree); renderTree(); }
export function toggleTerminal(force) { const panel = ui.panel, show = force ?? panel.hidden; panel.hidden = !show; document.body.classList.toggle("term-open", show);
  if (show && !opened) { opened = true; term = new window.Terminal({ fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace', fontSize: 13, cursorBlink: true, convertEol: false,
      theme: { background: "#0c0c0c", foreground: "#ececec", cursor: "#ff6a2b", selectionBackground: "#3a3a3a", black: "#111111", blue: "#82aaff", brightBlack: "#6a6a6a" } });
    fit = new window.FitAddon.FitAddon(); term.loadAddon(fit); term.open(ui.host); term.onData(onData); new ResizeObserver(() => { try { fit.fit(); } catch {} }).observe(ui.host);
    outln(C.acc("WrenbyAI terminal") + C.dim("  ·  type help  ·  files are saved in this browser")); prompt(); }
  if (show) setTimeout(() => { try { fit.fit(); } catch {} term.focus(); }, 30); return show; }
export const termRun = async cmd => { toggleTerminal(true); for (const ch of cmd) await onData(ch); await onData("\r"); };
