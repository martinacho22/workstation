# Workstation — Full Design Spec

## Vision

An infinite canvas desktop app for solo builders. Instead of juggling a terminal, a chat window, and scattered notes, everything lives in one visual space. Each section of your project is a node. Nodes connect with dependency arrows. You zoom out to see the architecture, zoom in to work.

---

## Core Mental Model

**Project → Sections → Each section is a node on the canvas**

Each section node contains:
- Left pane: Claude Code terminal (CLI, not API)
- Right pane: Reasoning chat (Claude API)
- Below: Auto-generated handoff doc node

---

## The Nodes

### 1. Overview Chat Node
- Anchored top-center of canvas
- Always visible — the "brain" of the project
- Connected to ALL section nodes with faint lines
- Use for: architecture decisions, "what should I build next", cross-section reasoning
- Powered by Claude API (Sonnet)

### 2. Section Node
- Main work unit
- Split: Terminal (left) | Reasoning Chat (right)
- Header: section name + status dot (grey/yellow/green)
- Expandable: double-click → full screen, click again → collapse to card
- Draggable anywhere on canvas
- Status: Not Started / In Progress / Blocked / Done

### 3. Handoff Doc Node
- Auto-generated at end of each session
- Lives below its parent section node
- Connected by animated line
- Preview: last 3 lines visible on card
- Pulses/glows when newly generated
- Full doc on click

---

## Canvas Behavior

### Zoom Levels
- **Zoomed out:** All nodes as small cards, all connections visible, full project at a glance
- **Zoomed in:** Nodes expand, terminals and chats become usable
- **Full screen:** Double-click any node, everything else fades

### Lines & Arrows
- Dependency lines between sections (drawn manually by user)
- Auto-lines: handoff doc → parent section
- Overview chat → all sections (faint, always present)
- Active lines animate subtly when a section is running

### Progress
- Background fill: canvas background slowly fills left-to-right as sections complete
- At 100%: full canvas glows briefly
- Each section node has its own mini progress ring

### Activity Indicators
- Active terminal running: node pulses
- Handoff doc generating: line between terminal and doc animates
- Completed sections: slightly faded so active ones pop

---

## Adding a New Section

1. Hit `+` anywhere on canvas
2. New section node appears
3. Name it
4. Drag it to where it makes sense spatially
5. Draw dependency line from connected sections
6. Terminal and chat spin up automatically

---

## Handoff Doc Format

Auto-generated at session end:

```markdown
## Section: [Name]
**Date:** [date]
**What was built:** [summary]
**Decisions made:** [key choices]
**Current status:** [state]
**Next steps:** [what's left]
**Files changed:** [file list]
```

---

## Token Routing

| Task | Route | Why |
|---|---|---|
| Writing/editing code | Claude Code CLI | Subscription = ~$0 |
| Architecture reasoning | Claude API Sonnet | Fast, smart |
| Debugging logic | Claude API Sonnet | Needs reasoning |
| Handoff doc generation | Claude API Haiku | Simple, cheap |
| Overview/planning | Claude API Sonnet | Cross-section reasoning |

Code NEVER touches the API. Only thinking does. ~80% cost reduction vs all-API approach.

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Desktop shell | Electron | Spawns real terminals, no browser restrictions |
| UI | React + TypeScript | Component model fits node architecture |
| Canvas | react-flow | Battle-tested, used by Vercel — handles nodes/edges/zoom/pan |
| Terminal rendering | xterm.js | Industry standard terminal emulator for web/electron |
| Terminal spawning | node-pty | Spawns real PTY processes (Claude Code CLI) |
| AI reasoning | Anthropic SDK | Claude API for chat nodes |
| Local storage | SQLite (better-sqlite3) | Projects, sections, history — fully offline |
| Styling | Tailwind CSS | Fast, consistent |

---

## MVP Build Order

### Phase 1 — Canvas Shell
- Electron app boots
- react-flow canvas renders
- Can add/drag/delete nodes
- Zoom and pan work

### Phase 2 — Section Nodes
- Section node renders with two panes
- xterm.js terminal renders in left pane
- node-pty spawns Claude Code CLI in terminal
- Basic reasoning chat in right pane (Claude API)

### Phase 3 — Overview Chat
- Overview chat node anchored top-center
- Connects to all section nodes
- Project context injected automatically

### Phase 4 — Handoff Docs
- Session end detected (terminal idle / manual trigger)
- Claude API (Haiku) generates handoff doc from session transcript
- Handoff doc node auto-appears below section
- Animated line connects them

### Phase 5 — Progress & Polish
- Background fill progress
- Activity pulses
- Status dots
- Node collapse/expand animations

---

## Design Language

- **Dark base** — deep charcoal (#0f0f0f), not pure black
- **Accent** — electric blue (#3b82f6) for active states
- **Success** — soft green (#22c55e) for completed sections
- **Lines** — subtle white at 15% opacity, blue at 60% when active
- **Motion** — subtle, purposeful — pulses breathe, lines flow, no flashiness
- **Typography** — Inter for UI, JetBrains Mono for terminals and code

---

## What Makes It Different

Everyone else builds AI tools that replace developers. Workstation is for the solo founder who IS the developer. It makes them **organized, consistent, and fast** — not replaced. The canvas makes the architecture of a project visible. The handoff docs make context persistent. The token routing makes it affordable.

This is the tool that lets one person build like a team.
