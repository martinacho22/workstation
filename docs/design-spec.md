# Workstation — Design Spec v1

> The operating system for solo builders — organized like a team, executed like a machine.

---

## The Problem

Right now a solo dev has Claude Code in one terminal, a chat window somewhere else, notes scattered across Notion, and no single place where the *project* lives. When you go on a tangent you open a new Claude chat. Then another. Then you forget which one you started in, which one has the bug fix, and what's left on the main thread. You have 8 Claude windows open and none of them have context from each other.

**Workstation fixes this.**

---

## Core Mental Model

Everything lives on an **infinite canvas**. The canvas has spatial grammar — things are where they are for a reason.

```
[Overview Chat] ──→ [Auth] ──→ [Payments ◉] ──→ [Dashboard]
                        │            │
                        ↓            ↓
                   [Tangent A ✓]  [Tangent B ···]
                        │                │
                        └── ties back ───┘
                             to [Payments]
```

- **Main flow runs left → right** — your project spine
- **Tangents drop downward** — from the section that triggered them
- **Tie-back line** closes the loop — solid when resolved, dashed when open
- **Minimized nodes** collapse to pills and drift to the nearest canvas corner

---

## Canvas Grammar

### Flow Direction
Main flow is horizontal. Each section is a stop on the journey. Overview Chat always anchors the left. Done sections fade but stay visible — the canvas is a record, not a to-do list.

### Tangents
Tangents are first-class, not accidents. When you go on a side tangent:
1. Spawn a tangent node from the section that triggered it — it drops below
2. A dashed line connects it back to its origin
3. Work in the tangent — it has its own terminal + chat
4. When done, resolve it — draw the tie-back line to where it landed
5. The tangent's key decisions auto-merge into the parent section's handoff doc
6. Tie-back line goes solid. Tangent fades slightly. Canvas stays clean.

### Minimize to Pills
Any node can minimize. It collapses to a small labeled pill and drifts to the nearest canvas edge/corner quadrant. Top-right section → pill sits top-right. Nothing disappears. Everything is findable by scanning the edges.

### Roadmap Overlay
Hit `R` — a semi-transparent roadmap overlay appears on the canvas. Shows the intended sequence of sections as a numbered path. Progress, blockers, done all visible. Claude (via chat or terminal) generates and updates it. Hit `R` again — gone, back to raw canvas.

---

## The Nodes

### Section Node
The main unit of work. Split card:
- **Left pane:** Claude Code terminal (embedded CLI — NOT API)
- **Right pane:** Reasoning chat (Claude API — Sonnet)
- **Header:** Section name + status dot
- **Footer:** Last handoff doc preview (3 lines)
- **Double-click:** Goes full screen, everything else fades
- **Gear icon:** Terminal settings — Standard / Skip permissions (acknowledged) / Read-only

### Overview Chat Node
- Anchored top-left, always visible
- Connected to ALL section nodes with faint lines — like a nervous system
- This is where you ask "what should I build next" or "how does auth connect to payments"
- Claude here has full project context injected automatically

### Handoff Doc Node
- Lives below its section node, connected by a line
- Shows last 3 lines as preview
- Pulses when newly generated
- Click to expand full doc

---

## Node States

| State | Visual |
|---|---|
| Active | Full color, single cyan glow — only one node glows at a time |
| In Progress | Normal brightness, pulsing border |
| Tangent (open) | Slightly muted, dashed tie-back line |
| Tangent (resolved) | Muted, solid tie-back line, faded |
| Done | Dimmed, green checkmark, stays on canvas |
| Minimized | Collapses to pill, drifts to nearest corner |

---

## Handoff Documents

Every node has a **living handoff doc**. Not generated once at the end — updated every session.

```
## Section: Payment System
Date: June 8, 2026

What was built: Stripe webhook handler, subscription logic
Decisions made: Used idempotency keys to handle duplicates
Status: Working locally, needs prod env vars
Next steps: Deploy to Railway, test with real card
Files changed: /api/webhooks/stripe.ts, /lib/stripe.ts
Tangents merged: Tangent B — webhook retry logic fix
```

**How it works:**
- When you start a session, the handoff doc loads as context into both terminal and chat
- When you end a session, it auto-updates
- When a tangent resolves and ties back, its decisions merge into the parent's doc
- All docs stored locally in SQLite, versioned — roll back to any session

---

## Token Routing — Subscription First

| Task | Route | Cost |
|---|---|---|
| Writing / editing code | Claude Code CLI (terminal) | ~$0 (subscription) |
| Debugging logic | Claude Code CLI (terminal) | ~$0 (subscription) |
| Architecture reasoning | Claude API — Sonnet | Small |
| Handoff doc generation | Claude API — Haiku | Tiny |
| Roadmap generation | Claude API — Sonnet | Small |
| Overview / planning | Claude API — Sonnet/Opus | Medium |

**Code never touches the API. Only thinking does.** That's ~80% cost reduction vs. all-API approach.

---

## Skills System

Each section node has a skills panel (toggle open/close). Workstation watches your current phase — planning / building / debugging / wrapping up — and recommends relevant Claude skills.

Toggle per-node, not globally. Some skills apply to all nodes (project memory), some are section-specific.

**Example skills:**
- 🟢 Memory (always on)
- 🟢 Code review
- 🟡 Web search
- ⚪ Image gen
- 🟢 Bash execution
- ⚪ Browser control

---

## Design Language

**Colors**
- Canvas: `#0d0d0f` — near-black, not pure black
- Node cards: `#141416` — slightly lighter, float on canvas
- Accent: `#00d4ff` — cyan (default, one per project)
- Tangent lines: `#ff9500` — amber
- Done: `#00ff88` — green
- Everything else: monochrome

**Typography**
- Monospace for all terminal content
- `-apple-system` sans-serif for UI chrome
- Small, readable, never cluttered

**Motion**
- Subtle. Active node pulses slowly.
- Lines brighten on hover of connected nodes
- Handoff doc line animates when generating
- Canvas background fills gradually as sections complete — at 100% it glows once

**Texture**
- Subtle dot grid on canvas — feels like a workspace, not a void
- Nodes have no heavy borders — they float

**One rule:** Only ONE node glows at a time. Glow = active. Everything else is calm.

---

## MVP Build Order

| Phase | What ships |
|---|---|
| 1 — Shell | Electron app, react-flow canvas, zoom/pan working |
| 2 — Nodes | Section node: terminal (node-pty + xterm.js) + chat pane (Claude API) |
| 3 — Flow | Main flow left→right, add section, draw dependency lines manually |
| 4 — Tangents | Spawn tangent from any node, dashed/solid tie-back lines |
| 5 — Handoff | Auto-generated handoff doc per node, tangent merge on resolve |

---

## Tech Stack

- **Electron** — desktop shell, spawns real terminal processes
- **React** — UI layer
- **react-flow** — infinite canvas, nodes, edges, zoom, pan, drag
- **node-pty** — spawns Claude Code CLI as real terminal process
- **xterm.js** — renders terminal inside UI node
- **Anthropic SDK** — Claude API for reasoning chats
- **SQLite (local)** — projects, sections, handoff docs, chat history, versioned

---

*Workstation Design Spec v1 — June 8, 2026*
