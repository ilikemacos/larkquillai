LarkquillAI Local v1: private, offline LarkquillAI that runs on your own computer.

| Model | Based on | Download | RAM |
|---|---|---|---|
| LarkquillAI Local 4B | Qwen3.5-4B (Qwen team, Apache-2.0) | 2.74 GB, 2 parts | 8 GB computer |
| LarkquillAI Local 8B | Granite-4.2-8B (IBM, Apache-2.0) | 5.35 GB, 3 parts | 16 GB computer |

**Easiest install (needs [Ollama](https://ollama.com/download)):**

macOS / Linux: `curl -fsSL https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.sh | sh -s -- 4b` (or `8b`)

Windows PowerShell: `$env:LARKQUILL_SIZE='4b'; irm https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.ps1 | iex`

**Manual:** download every `.partN` of one model, join them (`cat part1 part2 ... > file.gguf` on macOS/Linux, `copy /b part1 + part2 file.gguf` on Windows), and check the result against `SHA256SUMS.txt`. Then open it in LM Studio, llama.cpp or Ollama. Full instructions, credits and licenses: see the README.

Model weights are unmodified upstream Q4_K_M GGUFs; only the GGUF name/description metadata was changed. Apache License 2.0.
