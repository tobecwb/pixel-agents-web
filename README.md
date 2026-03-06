# Pixel Agents Web

A standalone web server that turns your Claude Code agents into animated pixel art characters in a virtual office.

Each Claude Code session you run spawns a character that walks around, sits at desks, and visually reflects what the agent is doing — typing when writing code, reading when searching files, waiting when it needs your attention.

Forked from [Pixel Agents](https://github.com/pablodelucca/pixel-agents) (VS Code extension) and converted to a standalone web server that monitors JSONL transcripts and serves the pixel art UI in a browser.

![Pixel Agents screenshot](webview-ui/public/Screenshot.jpg)

## Features

- **Observe-only** — watches Claude Code JSONL transcripts, no terminal management needed
- **Live activity tracking** — characters animate based on what the agent is actually doing (writing, reading, running commands)
- **Office layout editor** — design your office with floors, walls, and furniture using a built-in editor
- **Speech bubbles** — visual indicators when an agent is waiting for input or needs permission
- **Sound notifications** — optional chime when an agent finishes its turn
- **Sub-agent visualization** — Task tool sub-agents spawn as separate characters linked to their parent
- **Persistent layouts** — your office design is saved at `~/.pixel-agents/layout.json`
- **Multi-browser support** — multiple browser tabs see the same state via WebSocket
- **Auto-reconnect** — browser reconnects automatically after server restart
- **Diverse characters** — 6 diverse characters based on the work of [JIK-A-4, Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack)

<p align="center">
  <img src="webview-ui/public/characters.png" alt="Pixel Agents characters" width="320" height="72" style="image-rendering: pixelated;">
</p>

## Requirements

- Node.js 18 or later
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and configured

## Getting Started

```bash
git clone https://github.com/tobe81cwb/pixel-agents-web.git
cd pixel-agents
npm install
cd webview-ui && npm install && cd ..
cd server && npm install && cd ..
npm run build:server
```

## Usage

```bash
# Start the server from your project directory
cd /path/to/your/project
node /path/to/pixel-agents-web/server/dist/index.cjs

# With options
node /path/to/pixel-agents-web/server/dist/index.cjs --port 3000 --open
```

1. Open `http://localhost:3000` in your browser
2. Start Claude Code in the same project directory — agents appear automatically
3. Click a character to follow it with the camera
4. Click **Layout** to edit the office
5. Use **Settings** to export/import layouts and toggle sound

## How It Works

The server watches Claude Code's JSONL transcript directory (`~/.claude/projects/<sanitized-cwd>/`) for new session files. When a new `.jsonl` file appears, it creates a character and starts tracking tool activity via file watching (triple-layer: `fs.watch` + `fs.watchFile` + polling).

Messages are broadcast to all connected browsers via WebSocket, using the same message protocol as the original VS Code extension. The React frontend is nearly identical — only the transport layer changed from VS Code `postMessage` to WebSocket.

## Build

```bash
# Build everything
cd webview-ui && npm run build && cd ..    # React app -> server/dist/webview/
cd server && node esbuild.cjs && cd ..     # Server -> server/dist/index.cjs + assets
```

Or from the root:
```bash
npm run build:server
```

## Tech Stack

- **Server**: Node.js, WebSocket (ws), esbuild, pngjs
- **Frontend**: React 19, TypeScript, Vite, Canvas 2D

## Layout Editor

The built-in editor lets you design your office:

- **Floor** — Full HSB color control
- **Walls** — Auto-tiling walls with color customization
- **Tools** — Select, paint, erase, place, eyedropper, pick
- **Undo/Redo** — 50 levels with Ctrl+Z / Ctrl+Y
- **Export/Import** — Share layouts as JSON files via the Settings modal

The grid is expandable up to 64x64 tiles.

### Office Assets

The office tileset is **[Office Interior Tileset (16x16)](https://donarg.itch.io/officetileset)** by **Donarg**, available on itch.io for **$2 USD**.

The tileset is not included in this repository. To use the full set of office furniture:

```bash
npm run import-tileset
```

The server will work without the tileset — you'll get default characters and basic layout.

## Known Limitations

- **CWD-based project detection** — the server must be started from the same directory where you run Claude Code
- **Heuristic-based status detection** — Claude Code's JSONL transcript format does not provide clear signals for when an agent is waiting or finished. Detection uses heuristics (idle timers, turn-duration events) and may occasionally misfire
- **No terminal management** — this is observe-only; you start/stop Claude Code sessions separately

## License

This project is licensed under the [MIT License](LICENSE).
