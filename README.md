# Workstation

> Infinite canvas for developers using Claude — organized, streamlined, terminal-first.

## What it is

Workstation is a desktop app (Electron + React) that gives every Claude session a home. Instead of 8 scattered Claude windows you can't tell apart, Workstation puts your whole project on an infinite canvas — main flow left to right, tangents dropping down, tie-backs closing the loop.

## The core idea

- **Main flow** — sections run left → right across the canvas (Auth → Payments → Dashboard)
- **Tangents** — bug fix or feature detour? Spawn a tangent node below. Dashed line = open, solid = resolved
- **Tie-backs** — when a tangent is done, draw a line back to what it affected. Canvas stays honest
- **Terminal-first** — Claude Code runs in the terminal (subscription, not API). Reasoning chat uses API. 80% cost reduction
- **Handoff docs** — every node has a living doc that updates each session. Never lose context again
- **Minimized pills** — any node minimizes to a pill in the corner. Canvas stays clean

## Run it

```bash
# Install
npm install

# Dev mode (React + Electron)
npm run dev

# Build
npm run build
```

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron |
| UI | React + TypeScript + Vite |
| Canvas | @xyflow/react (react-flow) |
| Terminal | node-pty + xterm.js |
| State | Zustand + immer + persist |
| Storage | better-sqlite3 (local) |
| Chat AI | Claude API (Anthropic SDK) |
| Code AI | Claude Code CLI (subscription) |

## API Key

Set your Anthropic key before launching:

```js
// In browser devtools console (dev mode):
window.__ANTHROPIC_KEY__ = 'sk-ant-...'
```

Production: key is stored in Electron secure store (never hardcoded).

## Design

Dark canvas (`#0a0a0f`), green accent (`#00ff88`), dot grid, single active glow. Inspired by Supabase's premium dark UI.

## Project structure

```
workstation/
├── electron/
│   ├── main.js          # Electron shell + PTY process manager
│   └── preload.js       # IPC bridge → window.electron
├── src/
│   ├── App.tsx           # Root — ReactFlow canvas
│   ├── components/
│   │   ├── canvas/       # Toolbar, ProjectSetup, RoadmapOverlay, MinimizedPills, ProgressBackground
│   │   ├── nodes/        # SectionNode, OverviewNode, HandoffNode, NodeHeader
│   │   ├── panes/        # TerminalPane (xterm), ChatPane (Claude API)
│   │   └── edges/        # FlowEdge, TangentEdge, TiebackEdge
│   ├── store/            # useWorkstationStore (Zustand)
│   ├── types/            # TypeScript types
│   └── styles/           # globals.css (design tokens)
└── docs/
    ├── design.md
    ├── design-spec.md
    └── mvp-scope.md
```
