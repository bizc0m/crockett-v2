const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crokETT", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  copyText: (text) => ipcRenderer.invoke("copy-text", text),
  openNewWindow: (url) => ipcRenderer.invoke("open-new-window", url),
  setPermissions: (perms) => ipcRenderer.invoke("set-permissions", perms),
  setPreferences: (prefs) => ipcRenderer.invoke("set-preferences", prefs),
  chooseChromeExtension: () => ipcRenderer.invoke("choose-chrome-extension"),
  loadChromeExtension: (path) => ipcRenderer.invoke("load-chrome-extension", path),
  unloadChromeExtension: (id) => ipcRenderer.invoke("unload-chrome-extension", id),
  listChromeExtensions: () => ipcRenderer.invoke("list-chrome-extensions"),
});
