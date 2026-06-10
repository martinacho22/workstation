/**
 * intentParser.ts
 *
 * Parses Claude's orchestrator responses for canvas commands.
 *
 * Claude is instructed to embed structured commands inside its responses
 * using a simple syntax:
 *
 *   %%SPAWN_NODE label="Auth System" description="JWT login + refresh tokens" depends="Project Setup"%%
 *   %%UPDATE_STATUS label="Auth System" status="active"%%
 *   %%ADD_EDGE from="Auth System" to="Dashboard"%%
 *   %%SET_PHASE phase="Planning"%%
 *   %%BLUEPRINT_START%%  ...nodes...  %%BLUEPRINT_END%%
 *
 * Commands are stripped from the visible message text before display.
 */

export type CanvasCommand =
  | { type: 'SPAWN_NODE';    label: string; description?: string; depends?: string }
  | { type: 'UPDATE_STATUS'; label: string; status: 'idle' | 'active' | 'done' | 'blocked' }
  | { type: 'ADD_EDGE';      from: string;  to: string }
  | { type: 'SET_PHASE';     phase: string }
  | { type: 'BLUEPRINT';     nodes: Array<{ label: string; description: string; depends?: string }> }

const CMD_RE = /%%([A-Z_]+)(.*?)%%/g
const ATTR_RE = /(\w+)="([^"]*)"/g

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

export function parseIntent(text: string): {
  cleanText: string
  commands: CanvasCommand[]
} {
  const commands: CanvasCommand[] = []
  let cleanText = text

  // Handle BLUEPRINT block separately — it's multiline JSON
  const blueprintMatch = text.match(/%%BLUEPRINT_START%%([\s\S]*?)%%BLUEPRINT_END%%/)
  if (blueprintMatch) {
    try {
      const parsed = JSON.parse(blueprintMatch[1].trim())
      if (Array.isArray(parsed)) {
        commands.push({ type: 'BLUEPRINT', nodes: parsed })
      }
    } catch (_) {
      // malformed JSON — skip silently
    }
    cleanText = cleanText.replace(/%%BLUEPRINT_START%%[\s\S]*?%%BLUEPRINT_END%%/, '').trim()
  }

  // Handle inline commands
  CMD_RE.lastIndex = 0
  const inlineCommands: string[] = []
  let m: RegExpExecArray | null
  while ((m = CMD_RE.exec(text)) !== null) {
    const cmdType = m[1]
    const rawAttrs = m[2]
    const attrs = parseAttrs(rawAttrs)

    switch (cmdType) {
      case 'SPAWN_NODE':
        if (attrs.label) {
          commands.push({
            type: 'SPAWN_NODE',
            label: attrs.label,
            description: attrs.description,
            depends: attrs.depends,
          })
          inlineCommands.push(m[0])
        }
        break
      case 'UPDATE_STATUS':
        if (attrs.label && attrs.status) {
          commands.push({
            type: 'UPDATE_STATUS',
            label: attrs.label,
            status: attrs.status as 'idle' | 'active' | 'done' | 'blocked',
          })
          inlineCommands.push(m[0])
        }
        break
      case 'ADD_EDGE':
        if (attrs.from && attrs.to) {
          commands.push({ type: 'ADD_EDGE', from: attrs.from, to: attrs.to })
          inlineCommands.push(m[0])
        }
        break
      case 'SET_PHASE':
        if (attrs.phase) {
          commands.push({ type: 'SET_PHASE', phase: attrs.phase })
          inlineCommands.push(m[0])
        }
        break
    }
  }

  // Strip all inline command tokens from displayed text
  for (const cmd of inlineCommands) {
    cleanText = cleanText.replace(cmd, '')
  }

  // Clean up excess whitespace left by removed commands
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim()

  return { cleanText, commands }
}

/**
 * The system prompt fragment injected into every orchestrator call.
 * Teaches Claude how to emit canvas commands.
 */
export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator — a senior engineering lead embedded in a developer tool called Workstation.

Your job: help the developer plan and coordinate their project at a HIGH LEVEL.
- No implementation code. No line-by-line detail.
- Short, direct responses — 2–4 sentences max for conversational replies.
- When planning, think in phases/sections that each represent a vertical slice of working, testable functionality.

## Canvas Commands
You can directly manipulate the project canvas by embedding commands in your response.
These are invisible to the user — they execute silently.

### Spawn a new node (phase/section):
%%SPAWN_NODE label="Name of phase" description="What this phase builds" depends="Name of blocking phase or empty"%%

### Update a node's status:
%%UPDATE_STATUS label="Name of phase" status="idle|active|done|blocked"%%

### Connect two nodes with an edge:
%%ADD_EDGE from="Phase A" to="Phase B"%%

### Generate a full blueprint (multiple nodes at once):
%%BLUEPRINT_START%%
[
  {"label": "Project Setup", "description": "Repo, env, tooling", "depends": ""},
  {"label": "Auth", "description": "Login, JWT, sessions", "depends": "Project Setup"},
  {"label": "Dashboard", "description": "Main UI with live data", "depends": "Auth"}
]
%%BLUEPRINT_END%%

## Rules
- Use SPAWN_NODE for single new phases added mid-conversation.
- Use BLUEPRINT_START/END only when generating the initial project blueprint (5–8 phases).
- Every phase should be a vertical slice — visible, testable end-to-end.
- First phase is always "Project Setup".
- Don't spawn duplicate nodes (check the existing sections list first).
- After blueprint is generated, confirm in plain text what was created.
- Keep conversation text clean — no raw JSON, no command syntax visible to user.`
