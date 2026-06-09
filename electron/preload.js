const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // ─── Terminal (PTY) ──────────────────────────────────────────────────────
  terminal: {
    create: (opts) => ipcRenderer.invoke('terminal:create', opts),
    write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.invoke('terminal:kill', { id }),
    onData: (id, cb) => {
      const channel = `terminal:data:${id}`
      ipcRenderer.on(channel, (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onExit: (id, cb) => {
      const channel = `terminal:exit:${id}`
      ipcRenderer.on(channel, cb)
      return () => ipcRenderer.removeAllListeners(channel)
    },
  },

  // ─── Claude CLI Bridge ───────────────────────────────────────────────────
  claude: {
    // One-shot: returns { success, result } or { success, error }
    run: (prompt, opts) => ipcRenderer.invoke('claude:run', { prompt, opts }),

    // Streaming: chunks come back via onChunk callback
    stream: (id, prompt, opts) => ipcRenderer.invoke('claude:stream', { id, prompt, opts }),
    onChunk: (id, cb) => {
      const channel = `claude:stream:chunk:${id}`
      ipcRenderer.on(channel, (_, chunk) => cb(chunk))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onStreamDone: (id, cb) => {
      const channel = `claude:stream:done:${id}`
      ipcRenderer.on(channel, (_, full) => cb(full))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onStreamError: (id, cb) => {
      const channel = `claude:stream:error:${id}`
      ipcRenderer.on(channel, (_, err) => cb(err))
      return () => ipcRenderer.removeAllListeners(channel)
    },

    // CLI health check
    status: () => ipcRenderer.invoke('claude:status'),

    // Update the path to the claude binary
    setPath: (p) => ipcRenderer.invoke('claude:set-path', { path: p }),
  },

  // ─── System dialogs ──────────────────────────────────────────────────────
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },
})
