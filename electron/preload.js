const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
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
})
