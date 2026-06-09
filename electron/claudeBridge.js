/**
 * claudeBridge.js
 * Spawns `claude -p "prompt"` via child_process and streams stdout back
 * to the renderer via IPC. No API key needed — uses the user's subscription.
 */

const { spawn, execSync } = require('child_process')
const { ipcMain } = require('electron')
const os = require('os')
const path = require('path')
const fs = require('fs')

// Which claude CLI to use — settable from settings
let claudePath = 'claude'

function setClaudePath(p) {
  claudePath = p || 'claude'
}

/**
 * Run a one-shot claude prompt and return the full response as a string.
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
    if (systemPrompt) { args.push('--system-prompt', systemPrompt) }

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

    proc.stdout.on('data', (data) => { output += data.toString() })
    proc.stderr.on('data', (data) => { errOutput += data.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code !== 0) {
        reject(new Error(errOutput || `claude exited with code ${code}`))
      } else {
        resolve(output.trim())
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Claude CLI not found.\nInstall: npm install -g @anthropic-ai/claude-code\nThen authenticate: claude'
        ))
      } else {
        reject(err)
      }
    })
  })
}

/**
 * Stream a claude prompt — calls progressCb with each chunk of stdout.
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

    proc.stderr.on('data', (data) => { errOutput += data.toString() })

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
 * REAL auth check — runs `claude -p "hi" --output-format json`
 * --max-tokens is NOT a valid CLI flag. This is the correct approach.
 * Returns { installed, authenticated, version, path, error }
 */
function checkClaudeStatus() {
  return new Promise((resolve) => {
    // Step 1: Is the binary there?
    const versionProc = spawn(claudePath, ['--version'], { shell: false })
    let versionOutput = ''

    versionProc.stdout.on('data', d => { versionOutput += d.toString() })
    versionProc.stderr.on('data', d => { versionOutput += d.toString() })

    versionProc.on('error', () => {
      resolve({
        installed: false,
        authenticated: false,
        version: null,
        path: null,
        error: 'NOT_INSTALLED',
      })
    })

    versionProc.on('close', (code) => {
      if (code !== 0) {
        resolve({
          installed: false,
          authenticated: false,
          version: null,
          path: null,
          error: 'NOT_INSTALLED',
        })
        return
      }

      const version = versionOutput.trim()

      // Step 2: Resolve the actual binary path
      let resolvedPath = claudePath
      try {
        resolvedPath = execSync(`which ${claudePath}`, { encoding: 'utf8' }).trim()
      } catch (_) {}

      // Step 3: Real auth check — run a minimal prompt
      // We use --output-format json so we can detect auth errors cleanly
      const authProc = spawn(claudePath, ['-p', 'respond with the word ok', '--output-format', 'json'], {
        shell: false,
        env: {
          ...process.env,
          // Unset any injected token that might be conflicting (Claude Desktop conflict)
          CLAUDE_CODE_OAUTH_TOKEN: undefined,
        },
      })

      let authOut = ''
      let authErr = ''

      authProc.stdout.on('data', d => { authOut += d.toString() })
      authProc.stderr.on('data', d => { authErr += d.toString() })

      authProc.on('close', (authCode) => {
        if (authCode === 0 && authOut.length > 0) {
          resolve({
            installed: true,
            authenticated: true,
            version,
            path: resolvedPath,
            error: null,
          })
        } else {
          const combined = (authOut + authErr).toLowerCase()
          let error = 'NOT_AUTHENTICATED'

          if (combined.includes('oauth') || combined.includes('token')) {
            error = 'TOKEN_CONFLICT' // Claude Desktop conflict
          } else if (combined.includes('network') || combined.includes('connect')) {
            error = 'NETWORK_ERROR'
          }

          resolve({
            installed: true,
            authenticated: false,
            version,
            path: resolvedPath,
            error,
            rawError: authErr || authOut,
          })
        }
      })

      authProc.on('error', () => {
        resolve({ installed: true, authenticated: false, version, path: resolvedPath, error: 'NOT_AUTHENTICATED' })
      })
    })
  })
}

/**
 * Attempt to fix common auth issues automatically.
 * Returns { success, message }
 */
function attemptAuthFix() {
  return new Promise((resolve) => {
    // Clear the cache directory
    const cacheDir = path.join(os.homedir(), '.claude', 'cache')
    try {
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true })
      }
    } catch (_) {}

    // Run claude /logout then signal the renderer to open a terminal for re-auth
    const logoutProc = spawn(claudePath, ['/logout'], { shell: false })

    logoutProc.on('close', () => {
      resolve({
        success: true,
        message: 'Cache cleared and logged out. Please run `claude` in your terminal to re-authenticate.',
      })
    })

    logoutProc.on('error', () => {
      resolve({
        success: false,
        message: 'Could not run logout. Please run `claude /logout` manually in your terminal.',
      })
    })
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerClaudeBridgeHandlers() {
  ipcMain.handle('claude:run', async (event, { prompt, opts }) => {
    try {
      const result = await runClaude(prompt, opts || {})
      return { success: true, result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('claude:stream', async (event, { id, prompt, opts }) => {
    try {
      const result = await streamClaude(
        prompt,
        (chunk) => { event.sender.send(`claude:stream:chunk:${id}`, chunk) },
        opts || {}
      )
      event.sender.send(`claude:stream:done:${id}`, result)
      return { success: true }
    } catch (err) {
      event.sender.send(`claude:stream:error:${id}`, err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('claude:status', async () => {
    return await checkClaudeStatus()
  })

  ipcMain.handle('claude:set-path', (event, { path: p }) => {
    setClaudePath(p)
    return { success: true }
  })

  ipcMain.handle('claude:fix-auth', async () => {
    return await attemptAuthFix()
  })
}

module.exports = {
  registerClaudeBridgeHandlers,
  runClaude,
  streamClaude,
  checkClaudeStatus,
  setClaudePath,
}
