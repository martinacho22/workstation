/**
 * claudeRunner.ts
 *
 * CLI-only Claude caller. No API key required. No API fallback.
 * All calls go through the Claude Code CLI via Electron IPC.
 *
 * If the CLI is not available (browser dev mode), returns a clear
 * "install Claude Code" message instead of silently failing or asking for a key.
 */

export interface RunClaudeOpts {
  skipPermissions?: boolean
  sessionId?: string
  continueSession?: boolean
  systemPrompt?: string
}

const NOT_AVAILABLE_MSG =
  `Claude CLI not connected. Open Settings → Claude and follow the setup steps to connect your Claude Code subscription.`

// ─── Run (one-shot) ──────────────────────────────────────────────────────────

export async function runClaude(prompt: string, opts: RunClaudeOpts = {}): Promise<string> {
  const electronAPI = (window as any).electron

  if (!electronAPI?.claude?.run) {
    // Running in browser without Electron — return instructional message
    return NOT_AVAILABLE_MSG
  }

  const res = await electronAPI.claude.run(prompt, {
    skipPermissions: opts.skipPermissions ?? false,
    sessionId: opts.sessionId,
    continueSession: opts.continueSession,
    systemPrompt: opts.systemPrompt,
  })

  if (res.success) return res.result

  // Surface a clean error — no fallback, no key prompt
  const err = res.error || 'Unknown CLI error'
  if (err.includes('not authenticated') || err.includes('not logged in') || err.includes('login')) {
    throw new Error(
      'Claude CLI is not authenticated. Run `claude` in your terminal to log in, then come back.'
    )
  }
  if (err.includes('not found') || err.includes('not installed') || err.includes('command not found')) {
    throw new Error(
      'Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code, then run `claude` to authenticate.'
    )
  }
  throw new Error(err)
}

// ─── Stream ──────────────────────────────────────────────────────────────────

export function streamClaude(
  prompt: string,
  progressCb: (chunk: string) => void,
  opts: RunClaudeOpts & { streamId?: string } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const electronAPI = (window as any).electron

    if (!electronAPI?.claude?.stream) {
      // Not in Electron — return instructional message without error
      const msg = NOT_AVAILABLE_MSG
      progressCb(msg)
      resolve(msg)
      return
    }

    const streamId = opts.streamId || Math.random().toString(36).slice(2)
    let fullText = ''

    const unsubChunk = electronAPI.claude.onChunk(streamId, (chunk: string) => {
      fullText += chunk
      progressCb(chunk)
    })

    const unsubDone = electronAPI.claude.onStreamDone(streamId, () => {
      unsubChunk()
      unsubDone()
      unsubErr()
      resolve(fullText)
    })

    const unsubErr = electronAPI.claude.onStreamError(streamId, (err: string) => {
      unsubChunk()
      unsubDone()
      unsubErr()

      if (err.includes('not authenticated') || err.includes('login')) {
        reject(new Error('Claude CLI not authenticated. Run `claude` in your terminal to log in.'))
      } else if (err.includes('not found') || err.includes('not installed')) {
        reject(new Error('Claude CLI not installed. Run: npm install -g @anthropic-ai/claude-code'))
      } else {
        reject(new Error(err))
      }
    })

    electronAPI.claude.stream(streamId, prompt, {
      skipPermissions: opts.skipPermissions ?? false,
      sessionId: opts.sessionId,
      continueSession: opts.continueSession,
      systemPrompt: opts.systemPrompt,
    })
  })
}

// ─── CLI status check ────────────────────────────────────────────────────────

export async function checkClaudeCliStatus(): Promise<{
  installed: boolean
  authenticated: boolean
  version: string | null
  error: string | null
} | null> {
  const electronAPI = (window as any).electron
  if (!electronAPI?.claude?.status) return null
  return electronAPI.claude.status()
}
