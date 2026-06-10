const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const os  = require('os')
const fs  = require('fs')

let pty
try { pty = require('node-pty') } catch (_) { pty = null }

const { registerClaudeBridgeHandlers, setClaudePath } = require('./claudeBridge')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

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
  createWindow()
  registerClaudeBridgeHandlers()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── PTY / Terminal IPC ───────────────────────────────────────────────────────

const terminals = {}

ipcMain.handle('terminal:create', (event, { id, shell: shellCmd, skipPermissions, cwd, presetPrompt }) => {
  if (!pty) return { success: false, error: 'node-pty not available — run npm install' }

  const shellToUse  = shellCmd || (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash')
  const isClaudeCode = shellCmd === 'claude'
  const launchArgs  = isClaudeCode && skipPermissions ? ['--dangerously-skip-permissions'] : []

  // Resolve cwd: use provided path, fall back to home
  const workDir = (cwd && fs.existsSync(cwd)) ? cwd : os.homedir()

  const ptyProcess = pty.spawn(shellToUse, launchArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: workDir,
    env: process.env,
  })

  terminals[id] = ptyProcess

  ptyProcess.onData(data => {
    mainWindow.webContents.send(`terminal:data:${id}`, data)
  })

  ptyProcess.onExit(() => {
    delete terminals[id]
    mainWindow.webContents.send(`terminal:exit:${id}`)
  })

  // If a preset prompt was provided, write it after a short delay
  // so the shell/claude has time to initialise
  if (presetPrompt) {
    setTimeout(() => {
      if (terminals[id]) {
        terminals[id].write(presetPrompt + '\r')
      }
    }, isClaudeCode ? 2000 : 500)
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

/**
 * Create (or verify) a project directory under ~/Workstation Projects/<name>
 * Returns { success, projectDir }
 */
ipcMain.handle('fs:createProjectDir', (event, { projectName }) => {
  try {
    const base = path.join(os.homedir(), 'Workstation Projects')
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })

    // Sanitise project name for filesystem
    const safeName = projectName
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      || 'project'

    const projectDir = path.join(base, safeName)
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true })

    // Write a minimal .workstation file so Claude Code knows the context
    const metaFile = path.join(projectDir, '.workstation')
    if (!fs.existsSync(metaFile)) {
      fs.writeFileSync(metaFile, JSON.stringify({ project: projectName, createdAt: Date.now() }, null, 2))
    }

    return { success: true, projectDir }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/**
 * Check if a directory exists and is accessible
 */
ipcMain.handle('fs:checkDir', (event, { dirPath }) => {
  try {
    const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
    return { exists }
  } catch {
    return { exists: false }
  }
})

/**
 * Open a project directory in Finder / Explorer
 */
ipcMain.handle('fs:openInFinder', (event, { dirPath }) => {
  if (dirPath && fs.existsSync(dirPath)) {
    shell.openPath(dirPath)
    return { success: true }
  }
  return { success: false, error: 'Directory not found' }
})
