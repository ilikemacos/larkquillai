# WrenbyAI

Chat-only WrenbyAI web app, plus a terminal CLI.

**Web:** https://ilikemacos.github.io/wrenbyai/
- Chat with streaming replies, thinking display, web search and markdown.
- Files WrenbyAI makes show up as cards with a preview and Download. Long files open in a side viewer (Esc to close), and several files can be downloaded as one zip.
- **Terminal** (button or Ctrl+`): a shell over a virtual filesystem saved in your browser. `help` lists the commands: `ls cd cat mkdir rm mv cp touch echo download zip upload`, `node file.js`, `python file.py`, and `wrenby "prompt"`.

## CLI

Needs Node 18 or newer. Run it in the folder you want to work in:

```sh
npx github:ilikemacos/wrenbyai
```

Or install it globally:

```sh
npm install -g github:ilikemacos/wrenbyai
wrenby
```

- `wrenby` starts an interactive session in the current folder.
- `wrenby "add a README to this project"` runs one task and exits.
- WrenbyAI can list and read files in this folder. It asks before writing a file or running a command. `-y` approves everything automatically.
- `--tier=spark|turbo|forge|zenith` sets the reply length.
- In a session, `/clear` forgets the conversation and `/exit` quits.

This package isn't published to npm.
