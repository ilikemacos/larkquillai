// Hard requests (Forge/Zenith, signed in) run in their own fresh cloud sandbox via /api/task.
// The client drives the agent one step per request and renders a live card.
import { authInfo } from "./auth.js";
export const LOOSE = /\b(run|build|test|tests|install|npm|pip|yarn|cargo|compile|execute|project|app|cli|server|scaffold|benchmark|multi[- ]?file)\b/i;
async function api(body, signal) { const a = authInfo();
  const r = await fetch(a.base + "/api/task", { method: "POST", signal, headers: { "content-type": "application/json", ...(a.token ? { authorization: "Bearer " + a.token } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || "HTTP " + r.status); e.status = r.status; e.body = j; throw e; } return j; }
export const classifyRemote = (prompt, tier) => api({ action: "classify", prompt, tier });
// Returns null when the server says it's not a hard task (caller falls back to normal chat).
export async function runCloudTask(bub, prompt, tier, { signal, onStatus } = {}) {
  const st = await api({ action: "start", prompt, tier }, signal); if (!st.hard) return null;
  const card = document.createElement("div"); card.className = "ctask";
  card.innerHTML = `<div class="cthead"><span class="ctdot"></span><b>Running in cloud sandbox</b><span class="ctstat"></span><span class="fgrow"></span><button class="ctstop">Stop</button></div><div class="ctmeta"></div><div class="ctlog"></div>`;
  bub.appendChild(card); const $ = s => card.querySelector(s), logEl = $(".ctlog"), stat = $(".ctstat");
  $(".ctmeta").textContent = `sandbox ${st.sandboxId} · ${tier} · up to ${st.maxSteps} steps · ${st.usedToday}/${st.limits.perDay} today`;
  let stopped = false; const stop = async () => { stopped = true; $(".ctstop").disabled = true; try { await api({ action: "stop", id: st.id }); } catch {} };
  $(".ctstop").onclick = stop; signal?.addEventListener("abort", stop);
  const line = (cls, txt) => { const d = document.createElement("div"); d.className = "ctl " + cls; d.textContent = txt; logEl.appendChild(d); logEl.scrollTop = 1e9; bub.closest("#log") && (bub.closest("#log").scrollTop = 1e9); return d; };
  let res = { status: "running" }, said = [];
  while (!stopped && res.status === "running") {
    stat.textContent = `· step ${(res.step || 0) + 1}/${st.maxSteps}`; onStatus?.(`Cloud sandbox · step ${(res.step || 0) + 1}`);
    try { res = await api({ action: "step", id: st.id }); } catch (e) { if (stopped) break; line("err", "error: " + e.message); res = { status: "failed" }; break; }
    for (const e of res.events || []) {
      if (e.type === "say") { said.push(e.text); line("say", e.text); }
      else if (e.type === "cmd") { line("cmd", "$ " + e.cmd); if (e.output?.trim()) line("out" + (e.exitCode ? " bad" : ""), e.output.trim()); line("dim", "exit " + e.exitCode); }
      else if (e.type === "write") line("dim", "wrote " + e.path + " (" + e.bytes + " bytes)");
      else if (e.type === "read") line("dim", "read " + e.path);
      else if (e.type === "error" || e.type === "limit") line("err", e.text);
    } }
  const final = stopped ? "stopped" : res.status; card.classList.add("end", final);
  stat.textContent = "· " + (final === "done" ? "finished, sandbox shut down" : final === "stopped" ? "stopped, sandbox shut down" : "failed"); $(".ctstop").remove();
  return { status: final, summary: res.summary || (stopped ? "Stopped." : said.at(-1) || ""), files: (res.files || []).map(f => ({ name: "/" + f.name, content: f.content })) };
}
