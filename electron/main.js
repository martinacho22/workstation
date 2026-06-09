const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const pty = require('node-pty')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── PTY / Terminal IPC ───────────────────────────────────────────────────────

const terminals = {}

ipcMain.handle('terminal:create', (event, { id, shell: shellCmd, skipPermissions }) => {
  const shell = shellCmd || (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash')

  const args = []

  // Claude Code launch with optional skip permissions
  const isClaudeCode = shellCmd === 'claude'
  const launchArgs = isClaudeCode && skipPermissions ? ['--dangerously-skip-permissions'] : []

  const ptyProcess = pty.spawn(shell, launchArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: os.homedir(),
    env: process.env,
  })

  terminals[id] = ptyProcess

  ptyProcess.onData((data) => {
    mainWindow.webContents.send(`terminal:data:${id}`, data)
  })

  ptyProcess.onExit(() => {
    delete terminals[id]
    mainWindow.webContents.send(`terminal:exit:${id}`)
  })

  return { success: true }
})

ipcMain.handle('terminal:write', (event, { id, data }) => {
  if (terminals[id]) {
    terminals[id].write(data)
    return { success: true }
  }
  return { success: false, error: 'Terminal not found' }
})

ipcMain.handle('terminal:resize', (event, { id, cols, rows }) => {
  if (terminals[id]) {
    terminals[id].resize(cols, rows)
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle('terminal:kill', (event, { id }) => {
  if (terminals[id]) {
    terminals[id].kill()
    delete terminals[id]
    return { success: true }
  }
  return { success: false }
})
