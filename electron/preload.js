const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {

  // ─── Terminal (PTY) ──────────────────────────────────────────────────────
  terminal: {
    /**
     * Create a terminal session.
     * opts: { id, shell?, skipPermissions?, cwd?, presetPrompt? }
     * - cwd: the working directory to spawn in (project folder)
     * - presetPrompt: text to auto-type after the shell/claude boots
     */
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
    run:    (prompt, opts) => ipcRenderer.invoke('claude:run', { prompt, opts }),
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

  // ─── System dialogs ──────────────────────────────────────────────────────
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },

  // ─── Filesystem helpers ──────────────────────────────────────────────────
  fs: {
    /**
     * Create ~/Workstation Projects/<projectName>/ on disk.
     * Returns { success, projectDir }
     */
    createProjectDir: (projectName) =>
      ipcRenderer.invoke('fs:createProjectDir', { projectName }),

    /**
     * Check whether a directory path exists.
     * Returns { exists: boolean }
     */
    checkDir: (dirPath) =>
      ipcRenderer.invoke('fs:checkDir', { dirPath }),

    /**
     * Open a directory in Finder / Explorer.
     */
    openInFinder: (dirPath) =>
      ipcRenderer.invoke('fs:openInFinder', { dirPath }),
  },
})
