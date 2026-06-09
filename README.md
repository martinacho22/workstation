# 🖥️ Workstation

> The operating system for solo builders — organized like a team, executed like a machine.

---

## What It Is

Workstation is an infinite canvas desktop app where every section of your project gets its own:
- **Claude Code terminal** (CLI — uses your subscription, not API tokens)
- **Reasoning chat** (Claude API — for planning, debugging logic, architecture)
- **Handoff doc** (auto-generated each session so you never lose context)

Everything lives on one canvas. You see how it all connects.

---

## The Canvas

- **Infinite canvas** powered by `react-flow` — zoom out to see the whole project, zoom in to work
- **Dependency arrows** — draw lines between sections to show what connects to what
- **Overview Chat node** — always anchored top-center, the brain of the project
- **Background fill progress** — canvas fills as sections complete
- **Live activity pulse** — nodes glow when Claude Code is actively running

---

## Token Routing (The Smart Part)

| Task | Route | Cost |
|---|---|---|
| Writing / editing code | Claude Code CLI | ~$0 (subscription) |
| Architecture reasoning | Claude API (Sonnet) | Small |
| Debugging logic | Claude API (Sonnet) | Small |
| Handoff doc generation | Claude API (Haiku) | Tiny |
| Overview / planning | Claude API (Sonnet) | Medium |

Code never touches the API. Only thinking does.

---

## Stack

- **Electron** — desktop shell, spawns real terminal processes
- **React** — UI
- **react-flow** — infinite canvas, nodes, edges, zoom, pan
- **node-pty** — spawns Claude Code CLI inside the app
- **xterm.js** — renders terminals inside nodes
- **Anthropic SDK** — reasoning chats
- **SQLite (local)** — projects, sections, handoff docs, chat history

---

## MVP Scope

1. Infinite canvas with react-flow
2. Overview Chat node (top center)
3. Add section node → terminal (left) + reasoning chat (right)
4. Draw dependency lines between sections
5. Handoff doc node auto-generates when session ends
6. Background fill progress

---

## Project Structure

```
workstation/
├── electron/          # Main process, terminal spawning, IPC
├── src/
│   ├── canvas/        # react-flow canvas, node types, edges
│   ├── nodes/         # OverviewChat, Section, HandoffDoc node components
│   ├── chat/          # Claude API reasoning chat
│   ├── terminal/      # xterm.js terminal component
│   ├── handoff/       # Handoff doc generation
│   ├── store/         # SQLite local storage
│   └── app.tsx        # Root
├── docs/
│   └── design.md      # Full design spec
└── package.json
```

---

## Status

🟡 **Scaffolding** — foundation being laid.

Built by Zane + Tank.
