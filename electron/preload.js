const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {

  // ─── Terminal (PTY) ──────────────────────────────────────────────────────
  terminal: {
    create:   (opts)           => ipcRenderer.invoke('terminal:create', opts),
    write:    (id, data)       => ipcRenderer.invoke('terminal:write', { id, data }),
    resize:   (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    kill:     (id)             => ipcRenderer.invoke('terminal:kill', { id }),
    onData: (id, cb) => {
      const ch = `terminal:data:${id}`
      ipcRenderer.on(ch, (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners(ch)
    },
    onExit: (id, cb) => {
      const ch = `terminal:exit:${id}`
      ipcRenderer.on(ch, cb)
      return () => ipcRenderer.removeAllListeners(ch)
    },
  },

  // ─── Claude CLI Bridge ───────────────────────────────────────────────────
  claude: {
    run:    (prompt, opts)     => ipcRenderer.invoke('claude:run',    { prompt, opts }),
    stream: (id, prompt, opts) => ipcRenderer.invoke('claude:stream', { id, prompt, opts }),
    onChunk: (id, cb) => {
      const ch = `claude:stream:chunk:${id}`
      ipcRenderer.on(ch, (_, chunk) => cb(chunk))
      return () => ipcRenderer.removeAllListeners(ch)
    },
    onStreamDone: (id, cb) => {
      const ch = `claude:stream:done:${id}`
      ipcRenderer.on(ch, (_, full) => cb(full))
      return () => ipcRenderer.removeAllListeners(ch)
    },
    onStreamError: (id, cb) => {
      const ch = `claude:stream:error:${id}`
      ipcRenderer.on(ch, (_, err) => cb(err))
      return () => ipcRenderer.removeAllListeners(ch)
    },
    status:  ()  => ipcRenderer.invoke('claude:status'),
    setPath: (p) => ipcRenderer.invoke('claude:set-path', { path: p }),
    fixAuth: ()  => ipcRenderer.invoke('claude:fix-auth'),
  },

  // ─── Diagnostics ─────────────────────────────────────────────────────────
  diagnostics: {
    pty: () => ipcRenderer.invoke('diagnostics:pty'),
  },

  // ─── System dialogs ──────────────────────────────────────────────────────
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },

  // ─── Filesystem helpers ──────────────────────────────────────────────────
  fs: {
    createProjectDir: (projectName) =>
      ipcRenderer.invoke('fs:createProjectDir', { projectName }),
    checkDir: (dirPath) =>
      ipcRenderer.invoke('fs:checkDir', { dirPath }),
    openInFinder: (dirPath) =>
      ipcRenderer.invoke('fs:openInFinder', { dirPath }),
    /** Read a directory and return its contents as a flat list of {name, path, isDir} */
    readDirectory: (dirPath) =>
      ipcRenderer.invoke('fs:readDirectory', { dirPath }),
  },
})
