/**
 * claudeBridge.js
 * Spawns `claude -p "prompt"` via child_process and streams stdout back
 * to the renderer via IPC. No API key needed — uses the user's subscription.
 */

const { spawn } = require('child_process')
const { ipcMain } = require('electron')

// Which claude CLI to use — settable from settings
let claudePath = 'claude'

function setClaudePath(p) {
  claudePath = p || 'claude'
}

/**
 * Run a one-shot claude prompt and return the full response as a string.
 * Falls back to API if CLI fails and apiKey is provided.
 */
function runClaude(prompt, opts = {}) {
  return new Promise((resolve, reject) => {
    const {
      skipPermissions = false,
      sessionId = null,
      continueSession = false,
      systemPrompt = null,
      timeout = 60000,
    } = opts

    const args = ['-p', prompt]

    if (skipPermissions) args.push('--dangerously-skip-permissions')
    if (continueSession) args.push('--continue')
    if (sessionId) { args.push('--resume'); args.push(sessionId) }

    // Inject system prompt via stdin flag if provided
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }

    const proc = spawn(claudePath, args, {
      env: { ...process.env },
      shell: false,
    })

    let output = ''
    let errOutput = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      reject(new Error('Claude CLI timed out after ' + timeout + 'ms'))
    }, timeout)

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      errOutput += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code !== 0) {
        // Surface a helpful error
        const msg = errOutput || `claude exited with code ${code}`
        reject(new Error(msg))
      } else {
        resolve(output.trim())
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code\n' +
          'Then authenticate: claude'
        ))
      } else {
        reject(err)
      }
    })
  })
}

/**
 * Stream a claude prompt — calls progressCb with each chunk of stdout.
 * Resolves when complete.
 */
function streamClaude(prompt, progressCb, opts = {}) {
  return new Promise((resolve, reject) => {
    const {
      skipPermissions = false,
      sessionId = null,
      continueSession = false,
      systemPrompt = null,
      timeout = 120000,
    } = opts

    const args = ['-p', prompt, '--stream']
    if (skipPermissions) args.push('--dangerously-skip-permissions')
    if (continueSession) args.push('--continue')
    if (sessionId) { args.push('--resume'); args.push(sessionId) }
    if (systemPrompt) args.push('--system-prompt', systemPrompt)

    const proc = spawn(claudePath, args, {
      env: { ...process.env },
      shell: false,
    })

    let fullOutput = ''
    let errOutput = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      reject(new Error('Claude CLI stream timed out'))
    }, timeout)

    proc.stdout.on('data', (data) => {
      const chunk = data.toString()
      fullOutput += chunk
      if (progressCb) progressCb(chunk)
    })

    proc.stderr.on('data', (data) => {
      errOutput += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code !== 0) {
        reject(new Error(errOutput || `claude exited with code ${code}`))
      } else {
        resolve(fullOutput.trim())
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/**
 * Check if claude CLI is installed and authenticated.
 * Returns { installed: bool, authenticated: bool, version: string | null, error: string | null }
 */
function checkClaudeStatus() {
  return new Promise((resolve) => {
    const proc = spawn(claudePath, ['--version'], { shell: false })
    let output = ''

    proc.stdout.on('data', d => { output += d.toString() })
    proc.stderr.on('data', d => { output += d.toString() })

    proc.on('close', (code) => {
      if (code === 0) {
        const version = output.trim()
        // Try a minimal auth check — `claude whoami` or similar
        checkAuth(version, resolve)
      } else {
        resolve({ installed: false, authenticated: false, version: null, error: 'Claude CLI not found' })
      }
    })

    proc.on('error', () => {
      resolve({ installed: false, authenticated: false, version: null, error: 'Claude CLI not installed' })
    })
  })
}

function checkAuth(version, resolve) {
  // Run `claude -p "hi" --max-tokens 1` as a quick auth check
  const proc = spawn(claudePath, ['-p', 'hi', '--max-tokens', '5'], { shell: false })
  let errOutput = ''

  proc.stderr.on('data', d => { errOutput += d.toString() })

  proc.on('close', (code) => {
    if (code === 0) {
      resolve({ installed: true, authenticated: true, version, error: null })
    } else {
      const isAuthError = errOutput.toLowerCase().includes('auth') ||
        errOutput.toLowerCase().includes('login') ||
        errOutput.toLowerCase().includes('not logged')
      resolve({
        installed: true,
        authenticated: false,
        version,
        error: isAuthError
          ? 'Not authenticated — run `claude` in your terminal to log in'
          : errOutput || 'Unknown error',
      })
    }
  })

  proc.on('error', () => {
    resolve({ installed: false, authenticated: false, version: null, error: 'CLI not found' })
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerClaudeBridgeHandlers() {
  // One-shot prompt → full response
  ipcMain.handle('claude:run', async (event, { prompt, opts }) => {
    try {
      const result = await runClaude(prompt, opts || {})
      return { success: true, result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Streaming prompt — sends chunks via event, resolves at end
  ipcMain.handle('claude:stream', async (event, { id, prompt, opts }) => {
    try {
      const result = await streamClaude(
        prompt,
        (chunk) => {
          // Send each chunk back to renderer
          event.sender.send(`claude:stream:chunk:${id}`, chunk)
        },
        opts || {}
      )
      event.sender.send(`claude:stream:done:${id}`, result)
      return { success: true }
    } catch (err) {
      event.sender.send(`claude:stream:error:${id}`, err.message)
      return { success: false, error: err.message }
    }
  })

  // Check CLI status
  ipcMain.handle('claude:status', async () => {
    return await checkClaudeStatus()
  })

  // Update CLI path
  ipcMain.handle('claude:set-path', (event, { path: p }) => {
    setClaudePath(p)
    return { success: true }
  })
}

module.exports = { registerClaudeBridgeHandlers, runClaude, streamClaude, checkClaudeStatus, setClaudePath }
