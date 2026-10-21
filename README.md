# LarkquillAI Local

Private, offline editions of [LarkquillAI](https://ilikemacos.github.io/larkquillai) that run on your own computer. No account, no internet connection, and nothing you type leaves your device.

| Model | Based on | Parameters | Download | RAM | Best for |
|---|---|---|---|---|---|
| **LarkquillAI Local 4B** | [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) by the Qwen team | 4.2B (text) | 2.74 GB | 8 GB computer (about 4 GB free) | Most laptops, quick everyday chat |
| **LarkquillAI Local 8B** | [Granite-4.2-8B](https://huggingface.co/ibm-granite/granite-4.2-8b) by IBM | 8.8B | 5.35 GB | 16 GB computer (about 8 GB free) | Better reasoning, writing and code |

Both are 4-bit (Q4_K_M) GGUF files. They run on the CPU, and faster on Apple Silicon or an NVIDIA/AMD GPU. They are text-only.

> These are small open models with LarkquillAI's name and personality. They are not the model behind the LarkquillAI website, which runs a much larger model in the cloud. Expect simpler answers and more mistakes than the online version, and no web access.

## Quick install (Ollama)

1. Install [Ollama](https://ollama.com/download) (version 0.17.5 or newer).
2. Run one command.

**macOS / Linux**

```sh
# 4B
curl -fsSL https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.sh | sh -s -- 4b
# 8B
curl -fsSL https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.sh | sh -s -- 8b
```

**Windows (PowerShell)**

```powershell
# 4B
$env:LARKQUILL_SIZE='4b'; irm https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.ps1 | iex
# 8B
$env:LARKQUILL_SIZE='8b'; irm https://raw.githubusercontent.com/ilikemacos/larkquillai/main/install/install.ps1 | iex
```

3. Chat:

```sh
ollama run larkquill-local:4b                 # or larkquill-local:8b
ollama run larkquill-local:4b --think=false   # faster, direct answers without step-by-step thinking
```

The installer downloads the parts from GitHub Releases, checks every SHA256, joins them, and registers the model with Ollama. It needs about 6 GB (4B) or 11 GB (8B) of free disk space while it works. After Ollama imports the model, the installer deletes its own copy; set `LARKQUILL_KEEP_GGUF=1` to keep the `.gguf` for LM Studio or llama.cpp. Files go to `~/.larkquill/models` (Windows: `%USERPROFILE%\.larkquill\models`); set `LARKQUILL_DIR` to change that.

## Manual download

Each model is split into parts under 1.9 GiB, because GitHub Releases allows at most 2 GiB per file. Download every part of one model from the [v1 release](https://github.com/ilikemacos/larkquillai/releases/tag/v1), then join them in order.

| File | Parts |
|---|---|
| `larkquill-local-4b-Q4_K_M.gguf` | `.part1`, `.part2` |
| `larkquill-local-8b-Q4_K_M.gguf` | `.part1`, `.part2`, `.part3` |

**Join on macOS / Linux**

```sh
cat larkquill-local-8b-Q4_K_M.gguf.part1 larkquill-local-8b-Q4_K_M.gguf.part2 larkquill-local-8b-Q4_K_M.gguf.part3 > larkquill-local-8b-Q4_K_M.gguf
shasum -a 256 larkquill-local-8b-Q4_K_M.gguf   # compare with SHA256SUMS.txt
```

**Join on Windows (Command Prompt)**

```bat
copy /b larkquill-local-8b-Q4_K_M.gguf.part1 + larkquill-local-8b-Q4_K_M.gguf.part2 + larkquill-local-8b-Q4_K_M.gguf.part3 larkquill-local-8b-Q4_K_M.gguf
certutil -hashfile larkquill-local-8b-Q4_K_M.gguf SHA256
```

For the 4B, use its two parts the same way.

Why plain parts and not llama.cpp `gguf-split` shards? Plain parts join into one ordinary `.gguf` that works everywhere: Ollama, LM Studio, llama.cpp, Jan and GPT4All. Split shards only load directly in llama.cpp-based apps.

## Run with Ollama (manual)

Put the joined `.gguf` and the matching Modelfile from [`modelfiles/`](modelfiles) in one folder, rename the Modelfile to `Modelfile`, then:

```sh
ollama create larkquill-local:8b -f Modelfile
ollama run larkquill-local:8b
```

The Modelfile sets the LarkquillAI Local system prompt, the chat template and the recommended sampling settings.

## Run with LM Studio

1. Join the parts as above.
2. In LM Studio, open **My Models**, then import the `.gguf` (or put it in `~/.lmstudio/models/larkquill/larkquill-local/`).
3. Load it. LM Studio reads the chat template from the file.
4. For the LarkquillAI personality, paste this into **System Prompt**:

   > You are LarkquillAI Local, the offline edition of LarkquillAI. You run entirely on the user's own computer: you have no internet access, cannot browse, and nothing the user types leaves their device. Be warm, clear and concise. Use Markdown when it helps. If you are not sure about something, say so instead of guessing.

5. Suggested settings. 4B: temperature 0.7, top-p 0.8, top-k 20, presence penalty 1.5. 8B: temperature 1.0, top-p 0.95.

In LM Studio and llama.cpp the 8B thinks step by step by default and the 4B answers directly.

## Run with llama.cpp

Get llama.cpp from [its releases](https://github.com/ggml-org/llama.cpp/releases), then:

```sh
# Chat in the terminal
llama-cli -m larkquill-local-4b-Q4_K_M.gguf --jinja -c 8192 \
  -sys "You are LarkquillAI Local, the offline edition of LarkquillAI." \
  --temp 0.7 --top-p 0.8 --top-k 20 --presence-penalty 1.5

# OpenAI-compatible local server on http://localhost:8080/v1
llama-server -m larkquill-local-8b-Q4_K_M.gguf --jinja -c 8192 --temp 1.0 --top-p 0.95
# 8B without thinking:
llama-server -m larkquill-local-8b-Q4_K_M.gguf --jinja -c 8192 --chat-template-kwargs '{"enable_thinking":false}'
```

Add `-ngl 99` to use a GPU if your llama.cpp build has GPU support.

## Checksums (SHA256)

```
ba7dc3db75204c76fe8657588397e9357091e2c9797761e5bb38b4d91163fb58  larkquill-local-4b-Q4_K_M.gguf
ebe8c85d5a21969c7716c68f99693ea9489d075611e66596a2dcfb5a26b3271c  larkquill-local-4b-Q4_K_M.gguf.part1
6ba386017073f583a3efc4cec1ccd77505832aef51960fe9a7043f950b1c3a33  larkquill-local-4b-Q4_K_M.gguf.part2
4f4af5025f0ebaa14373405bd07b65603d0c3078b4eecf6dafc2a19d9811ddf5  larkquill-local-8b-Q4_K_M.gguf
a97de6f8e5f83ab6588cb29828d614f7bde22b23e24da528250f73ef1384724c  larkquill-local-8b-Q4_K_M.gguf.part1
d1916bc2e5829a67de90357136a2994aa583b1bf77173befad7c4f7d7d7bc0e5  larkquill-local-8b-Q4_K_M.gguf.part2
835cd8261d33f58c09de4e5e77f9fa2e742489f8ef15dedc5c73f1c3eb437dcc  larkquill-local-8b-Q4_K_M.gguf.part3
```

The same list is in [`SHA256SUMS.txt`](SHA256SUMS.txt).

## What was changed

The model weights are exactly the upstream quantized weights. Only two GGUF metadata fields were changed: `general.name` (now "Larkquill Local 4B" / "Larkquill Local 8B") and `general.description`. The base-model fields inside the file still credit the original authors. The LarkquillAI identity comes from the system prompt in the Modelfile, not from retraining.

[`scripts/build-release.sh`](scripts/build-release.sh) rebuilds every release file from the upstream GGUFs and checks it against `SHA256SUMS.txt`, so anyone can verify the release. The [Publish model release](.github/workflows/publish-release.yml) workflow runs the same script on GitHub and uploads the parts.

| Release file | Upstream file | Upstream SHA256 |
|---|---|---|
| 4B | [`unsloth/Qwen3.5-4B-GGUF`](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF) `Qwen3.5-4B-Q4_K_M.gguf` | `00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4` |
| 8B | [`ibm-granite/granite-4.2-8b-GGUF`](https://huggingface.co/ibm-granite/granite-4.2-8b-GGUF) `granite-4.2-8b-Q4_K_M.gguf` | `16a9369d0805f80b7377d25d87f937a90c05dc04ad79173a52001e42c9aab311` |

## Credits and license

- **LarkquillAI Local 4B** is based on **Qwen3.5-4B**, Copyright 2026 Alibaba Cloud, licensed under the Apache License 2.0 ([license](licenses/Qwen3.5-4B-LICENSE.txt)). GGUF quantization by [Unsloth](https://unsloth.ai).
- **LarkquillAI Local 8B** is based on **Granite-4.2-8B** by IBM, licensed under the Apache License 2.0 ([license](licenses/Granite-4.2-8B-LICENSE.txt)). GGUF quantization by IBM.
- Everything else in this repository (Modelfiles, install scripts, docs) is Copyright 2026 LarkquillAI and licensed under the [Apache License 2.0](LICENSE).

See [NOTICE](NOTICE). "Qwen" and "Granite" are trademarks of their owners. LarkquillAI is not affiliated with or endorsed by Alibaba Cloud or IBM.

The models can be wrong, biased or out of date. Check anything important.
