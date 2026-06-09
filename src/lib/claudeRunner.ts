/**
 * claudeRunner.ts
 *
 * Unified Claude caller — CLI-first, API fallback.
 *
 * Priority:
 *  1. Electron window.electron.claude.run()  → spawns `claude -p` CLI (subscription, free)
 *  2. Direct Anthropic API fetch              → fallback if CLI not available / not in Electron
 *
 * Usage:
 *   const result = await runClaude(prompt, { apiKey, skipPermissions })
 */

export interface RunClaudeOpts {
  apiKey?: string
  skipPermissions?: boolean
  sessionId?: string
  continueSession?: boolean
  model?: string
  maxTokens?: number
  systemPrompt?: string
}

export async function runClaude(prompt: string, opts: RunClaudeOpts = {}): Promise<string> {
  const {
    apiKey,
    skipPermissions = false,
    sessionId,
    continueSession,
    model = 'claude-haiku-4-5',
    maxTokens = 1200,
    systemPrompt,
  } = opts

  // ── Path 1: Electron CLI bridge (preferred — uses subscription) ──────────
  const electronAPI = (window as any).electron
  if (electronAPI?.claude?.run) {
    const res = await electronAPI.claude.run(prompt, {
      skipPermissions,
      sessionId,
      continueSession,
      systemPrompt,
    })
    if (res.success) return res.result
    // If CLI fails with a "not found" error, fall through to API
    if (!res.error?.includes('not found') && !res.error?.includes('not installed')) {
      throw new Error(res.error)
    }
    // CLI not available — fall through to API
  }

  // ── Path 2: Direct API (fallback — needs API key) ────────────────────────
  if (!apiKey) {
    throw new Error(
      'Claude CLI not found and no API key set.\n' +
      'Install Claude CLI: npm install -g @anthropic-ai/claude-code\n' +
      'Or add an API key in Settings.'
    )
  }

  const messages: { role: string; content: string }[] = [
    { role: 'user', content: prompt },
  ]

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || `API error ${res.status}`)
  return json.content?.[0]?.text || ''
}

/**
 * Stream version — calls progressCb with each chunk, resolves with full text.
 * Falls back to non-streaming API if CLI unavailable.
 */
export function streamClaude(
  prompt: string,
  progressCb: (chunk: string) => void,
  opts: RunClaudeOpts & { streamId?: string } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const electronAPI = (window as any).electron
    const streamId = opts.streamId || Math.random().toString(36).slice(2)

    if (electronAPI?.claude?.stream) {
      let fullText = ''

      const unsubChunk = electronAPI.claude.onChunk(streamId, (chunk: string) => {
        fullText += chunk
        progressCb(chunk)
      })
      const unsubDone = electronAPI.claude.onStreamDone(streamId, (_full: string) => {
        unsubChunk()
        unsubDone()
        unsubErr()
        resolve(fullText)
      })
      const unsubErr = electronAPI.claude.onStreamError(streamId, (err: string) => {
        unsubChunk()
        unsubDone()
        unsubErr()
        // If CLI not found, fall through to non-streaming API
        if (err.includes('not found') || err.includes('not installed')) {
          runClaude(prompt, opts).then(text => {
            progressCb(text)
            resolve(text)
          }).catch(reject)
        } else {
          reject(new Error(err))
        }
      })

      electronAPI.claude.stream(streamId, prompt, {
        skipPermissions: opts.skipPermissions,
        sessionId: opts.sessionId,
        continueSession: opts.continueSession,
        systemPrompt: opts.systemPrompt,
      })
    } else {
      // No Electron — use API, simulate streaming by returning full response
      runClaude(prompt, opts).then(text => {
        progressCb(text)
        resolve(text)
      }).catch(reject)
    }
  })
}

/**
 * Check Claude CLI status — returns null if not in Electron context.
 */
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
