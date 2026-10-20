# LarkquillAI

Chat-only LarkquillAI web app, plus a terminal CLI.

**Web:** https://ilikemacos.github.io/larkquillai/
- Chat with streaming replies, thinking display, web search and markdown.
- Files LarkquillAI makes show up as cards with a preview and Download. Long files open in a side viewer (Esc to close), and several files can be downloaded as one zip.
- **Terminal** (button or Ctrl+`): a shell over a virtual filesystem saved in your browser. `help` lists the commands: `ls cd cat mkdir rm mv cp touch echo download zip upload`, `node file.js`, `python file.py`, and `larkquill "prompt"`.

## CLI

Needs Node 18 or newer. Run it in the folder you want to work in:

```sh
npx github:ilikemacos/larkquillai
```

Or install it globally:

```sh
npm install -g github:ilikemacos/larkquillai
larkquill
```

- The old command `wrenby` still works as an alias.
- `larkquill` starts an interactive session in the current folder.
- `larkquill "add a README to this project"` runs one task and exits.
- LarkquillAI can list and read files in this folder. It asks before writing a file or running a command. `-y` approves everything automatically.
- `--tier=chirp|trill|aria|chorus` sets the reply length.
- In a session, `/clear` forgets the conversation and `/exit` quits.

This package isn't published to npm.

## Desktop app (Windows and macOS)

macOS (Terminal):

```sh
curl -fsSL https://ilikemacos.github.io/larkquillai/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://ilikemacos.github.io/larkquillai/install.ps1 | iex
```

Both scripts pick the latest release from [ilikemacos/wyneai-desktop](https://github.com/ilikemacos/wyneai-desktop/releases/latest). The app updates itself on launch.

## Developer API

The chat app lives on GitHub Pages at https://ilikemacos.github.io/larkquillai/ (also reachable at https://larkquill.chopstickshq.com). GitHub Pages is static, so the API runs on Vercel:

- Dashboard and API keys: https://larkquillai.vercel.app/api
- OpenAI-compatible base URL: `https://larkquillai.vercel.app/v1`
- Models: `larkquill-chirp-1`, `larkquill-trill-1`, `larkquill-aria-1.5`, `larkquill-chorus-0.7`

LarkquillAI was called WrenbyAI until October 2026. The old `wrenby-*` model IDs, the old base URLs (`https://preset-ai-chat.vercel.app/v1`, `https://wrenbyai.chopstickshq.com/v1`, and the alias `https://larkquillai.chopstickshq.com/v1`) and https://ilikemacos.github.io/wrenbyai/ all still work.
