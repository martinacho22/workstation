# Workstation MVP — Scope & Build Order

## What MVP Ships

A working Electron app where you can:
1. Open a project on an infinite canvas
2. Add section nodes — each with a real Claude Code terminal + reasoning chat
3. Draw dependency arrows between sections
4. See an Overview Chat node at the top
5. Get an auto-generated handoff doc when a session ends

That's it. No bells, no polish. Just the core loop working.

---

## Phase 1 — Canvas Shell (Day 1–2)
- [ ] Electron app boots to a dark canvas
- [ ] react-flow renders with zoom + pan
- [ ] Can add a blank node, drag it, delete it
- [ ] Overview Chat node anchored top-center, can't be deleted

## Phase 2 — Section Nodes (Day 3–5)
- [ ] Section node renders with two panes (terminal left, chat right)
- [ ] xterm.js terminal renders in left pane
- [ ] node-pty spawns a shell in the terminal (bash first, Claude Code path config later)
- [ ] Reasoning chat in right pane — sends messages to Claude API, streams response
- [ ] Section name editable, status dot (grey by default)

## Phase 3 — Overview Chat (Day 6)
- [ ] Overview chat sends/receives Claude API messages
- [ ] Project context (name, stack, section names) injected into system prompt
- [ ] Faint lines from overview node to all section nodes

## Phase 4 — Handoff Docs (Day 7–8)
- [ ] "End Session" button on each section node
- [ ] On click: send terminal transcript + chat history to Claude API (Haiku)
- [ ] Haiku generates handoff doc in standard format
- [ ] Handoff doc node auto-appears below section, connected by animated line
- [ ] Doc saved to SQLite

## Phase 5 — Polish (Day 9–10)
- [ ] Background fill progress
- [ ] Activity pulse on active terminals
- [ ] Node collapse (card) / expand (full pane) behavior
- [ ] Status dot manual toggle
- [ ] Dependency arrow drawing (react-flow edge creation)

---

## What's NOT in MVP
- User accounts / cloud sync
- Multiple projects in one window
- Custom LLM routing (hardcoded Sonnet + Haiku for now)
- Mobile
- Collaboration

---

## Success Criteria for MVP

A solo dev can:
1. Boot the app
2. Create a project with 3 sections
3. Write real code in each terminal using Claude Code
4. Get a handoff doc at the end
5. Come back the next day, read the doc, and know exactly where they left off

If that works, MVP is done.
