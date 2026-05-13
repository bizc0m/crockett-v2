const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crokETT", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openNewWindow: (url) => ipcRenderer.invoke("open-new-window", url),
  copyText: (text) => ipcRenderer.invoke("copy-text", text),
  setPermissions: (permissions) => ipcRenderer.invoke("set-permissions", permissions),
  setPreferences: (preferences) => ipcRenderer.invoke("set-preferences", preferences),
  chooseChromeExtension: () => ipcRenderer.invoke("choose-chrome-extension"),
  loadChromeExtension: (path) => ipcRenderer.invoke("load-chrome-extension", path),
  unloadChromeExtension: (id) => ipcRenderer.invoke("unload-chrome-extension", id),
  listChromeExtensions: () => ipcRenderer.invoke("list-chrome-extensions")
});
