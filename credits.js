// Small "Credits" button: any element with [data-lq-credits] opens a popover with the open-model credits.
(() => {
  const N = "https://github.com/ilikemacos/larkquillai/blob/models/NOTICE";
  const L = "https://github.com/ilikemacos/larkquillai/tree/models/licenses";
  let pop;
  function close() { pop?.remove(); pop = null; document.removeEventListener("keydown", esc); }
  function esc(e) { if (e.key === "Escape") close(); }
  function open(btn) {
    if (pop) return close();
    pop = document.createElement("div"); pop.className = "lq-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Credits");
    pop.innerHTML = `<button class="x" type="button" aria-label="Close">×</button><h3>Credits</h3>
      <p>LarkquillAI Local runs open-weight models, used under the Apache License 2.0:</p>
      <ul><li>Local 4B: Qwen3.5-4B by the Qwen team (Alibaba Cloud), GGUF by Unsloth</li><li>Local 8B: Granite-4.2-8B by IBM</li></ul>
      <p>The weights are unchanged. <a href="${N}" target="_blank" rel="noopener">Full notice</a> · <a href="${L}" target="_blank" rel="noopener">Licenses</a></p>`;
    pop.querySelector(".x").onclick = close; document.body.appendChild(pop); document.addEventListener("keydown", esc);
    pop.querySelector(".x").focus();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-lq-credits]"); if (b) { e.preventDefault(); open(b); return; }
    if (pop && !pop.contains(e.target)) close();
  });
})();
