#!/usr/bin/env node
// LarkquillAI CLI: interactive terminal agent. No dependencies (Node 18+).
import fs from "node:fs/promises"; import path from "node:path"; import { spawn } from "node:child_process"; import readline from "node:readline";
const API = process.env.LARKQUILL_API || process.env.WRENBY_API || "https://larkquillai.vercel.app/api/chat";
const argv = process.argv.slice(2); const YES = argv.includes("-y") || argv.includes("--yes"); const once = argv.filter(a => !a.startsWith("-")).join(" ");
const TIER_IN = (argv.find(a => a.startsWith("--tier=")) || "--tier=turbo").slice(7).toLowerCase(); const TIER = ({ chirp: "spark", trill: "turbo", aria: "forge", chorus: "zenith", wren: "spark", scribe: "turbo", sage: "forge", sovereign: "zenith" })[TIER_IN.replace(/[-\s]?[\d.]+$/, "")] || TIER_IN; const MAXT = { spark: 6144, turbo: 24576, forge: 49152, zenith: 73728 }[TIER] || 24576;
if (argv.includes("-h") || argv.includes("--help")) { console.log(`larkquill — LarkquillAI coding agent for your terminal

  larkquill              interactive session in the current folder
  larkquill "prompt"     run one task and exit
  -y, --yes              approve every file write and command without asking
  --tier=wren|scribe|sage|sovereign   model: Quill Wren 1.2, Quill Scribe 1 (default), Quill Sage 1.5, Quill Sovereign 0.5 (old chirp|trill|aria|chorus still work)

In a session: /exit to quit, /clear to forget the conversation, /help.`); process.exit(0); }
const ROOT = process.cwd(); const tty = process.stdout.isTTY;
const c = (n, s) => tty ? `\x1b[${n}m${s}\x1b[0m` : s; const dim = s => c(2, s), acc = s => tty ? `\x1b[38;2;255;106;43m${s}\x1b[0m` : s, red = s => c(31, s), grn = s => c(32, s);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
const lines = []; let waiter = null, closed = false;
rl.on("line", l => waiter ? (waiter(l), waiter = null) : lines.push(l)); rl.on("close", () => { closed = true; waiter?.(null); });
const ask = q => { process.stdout.write(q); return lines.length ? Promise.resolve((process.stdout.write(lines[0] + "\n"), lines.shift())) : closed ? Promise.resolve(null) : new Promise(r => waiter = r); };
const confirm = async q => { if (YES) { console.log(dim(q + " (auto-approved)")); return true; } const a = await ask(acc("? ") + q + " [y/N] "); return /^y(es)?$/i.test((a || "").trim()); };
const safe = p => { const abs = path.resolve(ROOT, p); if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error("path is outside the current folder"); return abs; };
const TOOLS = [
  { name: "list_files", description: "List files under a folder (recursive, skips node_modules and .git).", parameters: { type: "object", properties: { dir: { type: "string", description: "relative folder, default ." } } } },
  { name: "read_file", description: "Read a text file.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Create or overwrite a file with COMPLETE content. The user confirms first.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "run_command", description: "Run a shell command in the current folder and get its output. The user confirms first.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
].map(f => ({ type: "function", function: f }));
async function walk(dir, out = [], depth = 0) { for (const e of await fs.readdir(dir, { withFileTypes: true })) { if (["node_modules", ".git"].includes(e.name) || out.length > 400) continue; const p = path.join(dir, e.name);
  if (e.isDirectory()) { out.push(path.relative(ROOT, p) + "/"); if (depth < 6) await walk(p, out, depth + 1); } else out.push(path.relative(ROOT, p)); } return out; }
function sh(cmd) { return new Promise(res => { const p = spawn(cmd, { shell: true, cwd: ROOT }); let o = ""; const on = d => { const s = d.toString(); o += s; process.stdout.write(dim(s)); };
  p.stdout.on("data", on); p.stderr.on("data", on); const t = setTimeout(() => p.kill("SIGTERM"), 120000); p.on("close", code => { clearTimeout(t); res({ exit_code: code, output: o.slice(-12000) }); }); }); }
async function runTool(name, a) { try { switch (name) {
  case "list_files": return { files: await walk(safe(a.dir || ".")) };
  case "read_file": { const t = await fs.readFile(safe(a.path), "utf8"); console.log(dim(`  read ${a.path}`)); return { content: t.slice(0, 60000), truncated: t.length > 60000 }; }
  case "write_file": { const abs = safe(a.path); let exists = true; try { await fs.access(abs); } catch { exists = false; }
    const n = String(a.content ?? "").split("\n").length; if (!(await confirm(`${exists ? "Overwrite" : "Create"} ${a.path} (${n} lines)?`))) return { ok: false, error: "user declined" };
    await fs.mkdir(path.dirname(abs), { recursive: true }); await fs.writeFile(abs, a.content ?? ""); console.log(grn("  ✓ wrote ") + a.path); return { ok: true }; }
  case "run_command": { if (!(await confirm(`Run: ${acc(a.command)}`))) return { ok: false, error: "user declined" }; const r = await sh(a.command); console.log(dim(`  exit ${r.exit_code}`)); return r; }
  default: return { ok: false, error: "unknown tool" }; } } catch (e) { return { ok: false, error: e.message }; } }
async function stream(messages, step) {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, tools: TOOLS, max_tokens: MAXT, tier: TIER, no_search: step > 0 }) });
  if (!res.ok) { let m = res.status, code; try { const j = await res.json(); m = j.error || m; code = j.code; } catch {} throw new Error(code === "token_limit" ? String(m) : res.status === 429 ? "rate limited, try again in a minute" : String(m)); }
  const dec = new TextDecoder(); let buf = "", content = "", thinking = false, started = false; const tc = [];
  const spin = tty ? setInterval(() => { if (!started) { process.stdout.write("\r" + dim((thinking ? "thinking" : "working") + ".".repeat((Date.now() / 400 | 0) % 4) + "   ")); } }, 200) : null;
  try { for await (const chunk of res.body) { buf += dec.decode(chunk, { stream: true }); let i;
    while ((i = buf.indexOf("\n\n")) >= 0) { const ev = buf.slice(0, i).trim(); buf = buf.slice(i + 2); if (!ev.startsWith("data:")) continue; const d = ev.slice(5).trim(); if (d === "[DONE]") continue; let j; try { j = JSON.parse(d); } catch { continue; }
      if (j.type === "search") { if (tty) process.stdout.write("\r\x1b[K"); console.log(dim(`  searched the web (${j.count} results)`)); continue; }
      if (j.reasoning) thinking = true;
      if (j.content) { if (!started) { started = true; if (tty) process.stdout.write("\r\x1b[K"); } content += j.content; process.stdout.write(j.content); }
      for (const t of j.tool_calls || []) { const k = t.index ?? tc.length; tc[k] ||= { id: "", type: "function", function: { name: "", arguments: "" } }; if (t.id) tc[k].id = t.id; if (t.function?.name) tc[k].function.name += t.function.name; if (t.function?.arguments) tc[k].function.arguments += t.function.arguments; } } } }
  finally { if (spin) clearInterval(spin); if (tty && !started) process.stdout.write("\r\x1b[K"); }
  if (started) process.stdout.write("\n"); tc.forEach((x, i) => { if (x && !x.id) x.id = "call_" + i; }); return { content, tool_calls: tc.filter(x => x?.function?.name) }; }
const system = () => `You are LarkquillAI, a coding agent running in the user's terminal, in the folder ${ROOT} (${process.platform}). Help them build, fix and understand code.
Use list_files / read_file to look before changing things. Use write_file with COMPLETE file contents (never placeholders) and run_command to run, test or install. Each write and command needs the user's OK; if they decline, adapt. Keep replies short plain text (light markdown is fine). Never name or hint at the underlying model or provider; if asked, you are LarkquillAI.`;
let history = [];
async function turn(text) { history.push({ role: "user", content: text }); const msgs = [{ role: "system", content: system() }, ...history];
  for (let step = 0; step < 20; step++) { const r = await stream(msgs, step); const a = { role: "assistant", content: r.content || null }; if (r.tool_calls.length) a.tool_calls = r.tool_calls; msgs.push(a);
    if (!r.tool_calls.length) break;
    for (const t of r.tool_calls) { let args = {}; try { args = JSON.parse(t.function.arguments || "{}"); } catch {} const res = await runTool(t.function.name, args); msgs.push({ role: "tool", tool_call_id: t.id, content: JSON.stringify(res).slice(0, 20000) }); } }
  history = msgs.slice(1).slice(-60); while (history[0]?.role === "tool") history.shift(); }
async function main() {
  if (once) { try { await turn(once); } catch (e) { console.error(red("larkquill: " + e.message)); process.exitCode = 1; } rl.close(); return; }
  console.log(acc("LarkquillAI") + dim(` · ${ROOT} · /help · /exit`));
  for (;;) { const l = await ask("\n" + acc("› ")); if (l == null) break; const t = l.trim(); if (!t) continue;
    if (t === "/exit" || t === "/quit") break; if (t === "/clear") { history = []; console.log(dim("conversation cleared")); continue; }
    if (t === "/help") { console.log("Describe what you want. LarkquillAI can read files here, write files and run commands (it asks first).\n/clear forget the conversation · /exit quit"); continue; }
    try { await turn(t); } catch (e) { console.error(red("error: " + e.message)); } }
  rl.close(); }
main();
