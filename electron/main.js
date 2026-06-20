const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const os   = require('os')
const fs   = require('fs')
const { execSync } = require('child_process')

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

// ─── Kill all PTY processes on quit ─────────────────────────────────────────
app.on('before-quit', () => {
  for (const [id, ptyProc] of Object.entries(terminals)) {
    try { ptyProc.kill() } catch (_) {}
    delete terminals[id]
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

// ─── Read directory listing ──────────────────────────────────────────────────

ipcMain.handle('fs:readDirectory', (event, { dirPath }) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
      return []
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const result = entries
      .filter(entry => !entry.name.startsWith('.')) // skip hidden files
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDir: entry.isDirectory(),
      }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })

    // For directories, also fetch children (one level deep)
    const withChildren = result.map(entry => {
      if (entry.isDir) {
        try {
          const children = fs.readdirSync(entry.path, { withFileTypes: true })
          entry.children = children
            .filter(c => !c.name.startsWith('.'))
            .map(c => ({
              name: c.name,
              path: path.join(entry.path, c.name),
              isDir: c.isDirectory(),
            }))
            .sort((a, b) => {
              if (a.isDir && !b.isDir) return -1
              if (!a.isDir && b.isDir) return 1
              return a.name.localeCompare(b.name)
            })
        } catch (_) {
          entry.children = []
        }
      }
      return entry
    })

    return withChildren
  } catch (err) {
    return []
  }
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
