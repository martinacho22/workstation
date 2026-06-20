const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const os   = require('os')
const fs   = require('fs')
const { execSync, spawn } = require('child_process')
const net = require('net')

let pty
try { pty = require('node-pty') } catch (_) { pty = null }

const { registerClaudeBridgeHandlers, setClaudePath } = require('./claudeBridge')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

// ─── Resolve full PATH so Electron can find `claude` ─────────────────────────
function resolveShellPath() {
  try {
    const shellBin = process.env.SHELL || '/bin/zsh'
    const result   = execSync(`${shellBin} -l -c 'echo $PATH'`, {
      timeout: 3000,
      encoding: 'utf8',
    }).trim()
    if (result) {
      process.env.PATH = result
    }
  } catch (_) {
    const extras = [
      path.join(os.homedir(), '.npm-global', 'bin'),
      path.join(os.homedir(), '.nvm', 'versions', 'node', 'current', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ]
    const existing = (process.env.PATH || '').split(':')
    process.env.PATH = [...new Set([...extras, ...existing])].join(':')
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1600,
    height:          1000,
    minWidth:        1200,
    minHeight:       700,
    backgroundColor: '#08080e',
    titleBarStyle:   'hiddenInset',
    trafficLightPosition: { x: 16, y: 12 },
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
}

app.whenReady().then(() => {
  resolveShellPath()
  createWindow()
  registerClaudeBridgeHandlers()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Dev Server ──────────────────────────────────────────────────────────────

let devServerProcess = null
let devServerPort    = null
let devServerCwd     = null
let devServerOutput  = []
const MAX_OUTPUT_LINES = 500

/**
 * Detect the most likely dev command and port from a project's package.json.
 */
function detectDevConfig(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return { command: 'npx serve .', port: 3000 }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const scripts = pkg.scripts || {}

    // Try common commands in priority order
    if (scripts.dev)  return { command: 'npm run dev',  port: 5173 }
    if (scripts.start) return { command: 'npm start',   port: 3000 }
    if (scripts.serve) return { command: 'npm run serve', port: 5000 }

    // Detect framework from dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps.next)        return { command: 'npm run dev',    port: 3000 }
    if (deps.vite)        return { command: 'npm run dev',    port: 5173 }
    if (deps['react-scripts']) return { command: 'npm start', port: 3000 }
    if (deps.svelte)      return { command: 'npm run dev',    port: 5173 }
    if (deps.astro)       return { command: 'npm run dev',    port: 4321 }
    if (deps.gatsby)      return { command: 'npm run develop', port: 8000 }
    if (deps.parcel)      return { command: 'npm run start',  port: 1234 }
    if (deps['@remix-run/react']) return { command: 'npm run dev', port: 5173 }

    return { command: 'npx serve .', port: 3000 }
  } catch {
    return { command: 'npx serve .', port: 3000 }
  }
}

/**
 * Test if a port is open (i.e. something is already listening there).
 */
function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(1500)
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('error', () => { socket.destroy(); resolve(false) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.connect(port, host || '127.0.0.1')
  })
}

ipcMain.handle('dev:start', async (event, { dir }) => {
  // Validate directory
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { success: false, error: `Directory not found: ${dir}` }
  }

  // Check if already running
  if (devServerProcess) {
    // Check if it's still alive
    try {
      if (devServerProcess.exitCode === null) {
        return {
          success: true,
          alreadyRunning: true,
          port: devServerPort,
          command: devServerProcess._command || 'unknown',
        }
      }
    } catch { /* dead, clear it */ }
    devServerProcess = null
    devServerPort = null
  }

  const config = detectDevConfig(dir)
  devServerCwd = dir
  devServerOutput = []

  // If the port is already open, return it as ready
  if (await isPortOpen(config.port, '127.0.0.1')) {
    devServerPort = config.port
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dev:ready', { port: config.port, url: `http://localhost:${config.port}` })
    }
    return { success: true, port: config.port, url: `http://localhost:${config.port}`, alreadyRunning: true }
  }

  // Try the detected command — fall back to npx serve if it fails
  let cmd = config.command
  let port = config.port

  try {
    const cmdParts = cmd.split(/\s+/)
    const bin = cmdParts[0]
    const args = cmdParts.slice(1)

    devServerProcess = spawn(bin, args, {
      cwd: dir,
      env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })
    devServerProcess._command = cmd

    let outputBuffer = ''
    let detectedPort = null

    const handleOutput = (data) => {
      const text = data.toString()
      outputBuffer += text
      devServerOutput.push(text)
      if (devServerOutput.length > MAX_OUTPUT_LINES) devServerOutput.shift()

      // Detect port from common dev server output patterns
      const portMatch = text.match(/https?:\/\/localhost:(\d+)/)
        || text.match(/(?:port|on)\s*:?\s*(\d{4,5})/i)
        || text.match(/Local:\s*https?:\/\/[^:]+:(\d+)/)
        || text.match(/(\d{4,5})\s*\/\s*http/)
      if (portMatch) {
        detectedPort = parseInt(portMatch[1])
      }

      // Send chunk to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dev:output', { text })
      }

      // Check if server is ready
      const readySignals = [
        /ready/i, /started/i, /listening on/i, /local:/i,
        /compiled successfully/i, /compiled with warnings/i,
        /server running/i, /available on/i, /running on/i,
      ]
      const ready = readySignals.some(r => r.test(text))
      if (ready || detectedPort) {
        const finalPort = detectedPort || port
        devServerPort = finalPort
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dev:ready', {
            port: finalPort,
            url: `http://localhost:${finalPort}`,
          })
        }
      }
    }

    devServerProcess.stdout.on('data', handleOutput)
    devServerProcess.stderr.on('data', handleOutput)

    devServerProcess.on('close', (code) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dev:exit', { code, output: devServerOutput.slice(-20) })
      }
      devServerProcess = null
      devServerPort = null
    })

    devServerProcess.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dev:error', { error: err.message })
      }
    })

    return { success: true, port, command: cmd, url: `http://localhost:${port}` }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('dev:stop', async () => {
  if (!devServerProcess) return { success: true, wasRunning: false }

  try {
    // Kill the process tree
    const pid = devServerProcess.pid
    if (pid) {
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {}
      }
    }
    devServerProcess.kill()
  } catch {}
  devServerProcess = null
  devServerPort = null
  return { success: true, wasRunning: true }
})

ipcMain.handle('dev:status', () => {
  const running = devServerProcess !== null && devServerProcess.exitCode === null
  return {
    running,
    port: devServerPort,
    cwd: devServerCwd,
    output: devServerOutput.slice(-50),
  }
})

// ─── File watcher — for auto-reload signals ──────────────────────────────────

const watchers = {}

ipcMain.handle('fs:watchDir', (event, { dir, id }) => {
  if (!dir || !fs.existsSync(dir)) return { success: false, error: 'Directory not found' }

  // Clean up existing watcher for this id
  if (watchers[id]) {
    watchers[id].close()
  }

  try {
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`fs:change:${id}`, { eventType, filename })
      }
    })
    watchers[id] = watcher
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:unwatchDir', (event, { id }) => {
  if (watchers[id]) {
    watchers[id].close()
    delete watchers[id]
  }
  return { success: true }
})

// ─── File read/write (for file tree) ─────────────────────────────────────────

ipcMain.handle('fs:readDir', (event, { dirPath }) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return { success: false, error: 'Path not found' }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const items = entries
      .filter(e => !e.name.startsWith('.')) // skip hidden files
      .map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDirectory: e.isDirectory(),
        // For symlinks, check what they point to
        isSymlink: e.isSymbolicLink(),
      }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      })
    return { success: true, items }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:readFile', (event, { filePath }) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'File not found' }
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return { success: false, error: 'Not a file' }
    // Don't read files larger than 1MB
    if (stat.size > 1024 * 1024) return { success: false, error: 'File too large (max 1MB)' }
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content, size: stat.size, mtime: stat.mtimeMs }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── PTY / Terminal IPC ───────────────────────────────────────────────────────

const terminals = {}

ipcMain.handle('terminal:create', (event, { id, shell: shellCmd, skipPermissions, cwd, presetPrompt }) => {
  if (!pty) {
    return {
      success: false,
      error: 'node-pty is not installed.\n\nRun: npm install\n\nThen restart Workstation.',
    }
  }

  const workDir = (cwd && fs.existsSync(cwd)) ? cwd : os.homedir()

  let ptyProcess

  if (shellCmd === 'claude') {
    let claudeBin = 'claude'
    try {
      claudeBin = execSync('which claude', { encoding: 'utf8', env: process.env }).trim()
    } catch (_) {
      const candidates = [
        path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
        path.join(os.homedir(), '.nvm', 'versions', 'node', 'current', 'bin', 'claude'),
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
      ]
      for (const c of candidates) {
        if (fs.existsSync(c)) { claudeBin = c; break }
      }
    }

    const args = skipPermissions ? ['--dangerously-skip-permissions'] : []

    try {
      ptyProcess = pty.spawn(claudeBin, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd:  workDir,
        env:  process.env,
      })
    } catch (spawnErr) {
      return {
        success: false,
        error: `Could not launch Claude Code: ${spawnErr.message}\n\nMake sure it is installed: npm install -g @anthropic-ai/claude-code`,
      }
    }

  } else {
    const shellToUse = shellCmd || (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh')

    try {
      ptyProcess = pty.spawn(shellToUse, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd:  workDir,
        env:  process.env,
      })
    } catch (spawnErr) {
      return { success: false, error: `Could not launch shell: ${spawnErr.message}` }
    }
  }

  terminals[id] = ptyProcess

  ptyProcess.onData(data => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`terminal:data:${id}`, data)
    }
  })

  ptyProcess.onExit(() => {
    delete terminals[id]
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`terminal:exit:${id}`)
    }
  })

  if (presetPrompt) {
    const delay = shellCmd === 'claude' ? 2500 : 500
    setTimeout(() => {
      if (terminals[id]) {
        terminals[id].write(presetPrompt + '\r')
      }
    }, delay)
  }

  return { success: true, resolvedCwd: workDir }
})

ipcMain.handle('terminal:write', (event, { id, data }) => {
  if (terminals[id]) { terminals[id].write(data); return { success: true } }
  return { success: false, error: 'Terminal not found' }
})

ipcMain.handle('terminal:resize', (event, { id, cols, rows }) => {
  if (terminals[id]) { terminals[id].resize(cols, rows); return { success: true } }
  return { success: false }
})

ipcMain.handle('terminal:kill', (event, { id }) => {
  if (terminals[id]) { terminals[id].kill(); delete terminals[id]; return { success: true } }
  return { success: false }
})

// ─── Claude CLI path ──────────────────────────────────────────────────────────

ipcMain.handle('claude:set-path', (event, { path: p }) => {
  setClaudePath(p)
  return { success: true }
})

// ─── Folder picker ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select your project folder',
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── Project directory management ─────────────────────────────────────────────

ipcMain.handle('fs:createProjectDir', (event, { projectName }) => {
  try {
    const base = path.join(os.homedir(), 'Workstation Projects')
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })

    const safeName = projectName
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      || 'project'

    const projectDir = path.join(base, safeName)
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true })

    const metaFile = path.join(projectDir, '.workstation')
    if (!fs.existsSync(metaFile)) {
      fs.writeFileSync(metaFile, JSON.stringify({ project: projectName, createdAt: Date.now() }, null, 2))
    }

    const claudeMd = path.join(projectDir, 'CLAUDE.md')
    if (!fs.existsSync(claudeMd)) {
      fs.writeFileSync(claudeMd,
        `# ${projectName}\n\nThis project is managed by Workstation.\n` +
        `You are an expert developer working on this project.\n` +
        `Always ask before making large structural changes.\n` +
        `Prefer vertical slices over horizontal layers.\n` +
        `Write tests alongside implementation.\n`
      )
    }

    return { success: true, projectDir }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:checkDir', (event, { dirPath }) => {
  try {
    const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
    return { exists }
  } catch {
    return { exists: false }
  }
})

ipcMain.handle('fs:openInFinder', (event, { dirPath }) => {
  if (dirPath && fs.existsSync(dirPath)) {
    shell.openPath(dirPath)
    return { success: true }
  }
  return { success: false, error: 'Directory not found' }
})

// ─── Cleanup on quit ─────────────────────────────────────────────────────────

app.on('before-quit', () => {
  // Kill dev server
  if (devServerProcess) {
    try {
      const pid = devServerProcess.pid
      if (pid) {
        try { process.kill(-pid, 'SIGTERM') } catch {}
        try { process.kill(pid, 'SIGTERM') } catch {}
      }
    } catch {}
  }

  // Close all file watchers
  Object.values(watchers).forEach(w => w.close())

  // Kill all PTY terminals
  Object.values(terminals).forEach(t => {
    try { t.kill() } catch {}
  })
})

// ─── Diagnostics ─────────────────────────────────────────────────────────────

ipcMain.handle('diagnostics:pty', () => {
  return {
    ptyAvailable: !!pty,
    path:         process.env.PATH,
    shell:        process.env.SHELL,
    home:         os.homedir(),
  }
})
