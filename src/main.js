import { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  expandHomePath,
  normalizeExternalUrl,
  normalizePermissionValue,
  safeDownloadFilename
} from "./shared/validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Avoid macOS Keychain prompts for Chromium cookie/password storage.
app.commandLine.appendSwitch("password-store", "basic");
app.commandLine.appendSwitch("use-mock-keychain");

let permissionPolicy = {
  notifications: "allow",
  camera: "ask",
  microphone: "ask",
  media: "ask",
  geolocation: "ask"
};
let downloadPolicy = {
  askDownloadLocation: true,
  downloadsPath: ""
};
const loadedExtensions = new Map();

function windowOptions(overrides = {}) {
  const base = {
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    title: "CrokETT",
    backgroundColor: "#f6f4ee",
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    trafficLightPosition: { x: 18, y: 20 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
  return {
    ...base,
    ...overrides,
    webPreferences: {
      ...base.webPreferences,
      ...(overrides.webPreferences || {})
    }
  };
}

function secureWindowOpen(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });
  win.webContents.on("did-attach-webview", (_event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url);
      return { action: "deny" };
    });
  });
}

function openExternalSafely(url) {
  const normalized = normalizeExternalUrl(url);
  if (normalized) shell.openExternal(normalized).catch(() => {});
}

function permissionAllowed(permission) {
  const mapped = permission === "media" ? permissionPolicy.media : permissionPolicy[permission];
  if (mapped === "allow") return true;
  if (mapped === "block") return false;
  return permission === "notifications" && permissionPolicy.notifications === "allow";
}

function expandHome(value) {
  return expandHomePath(value, os.homedir());
}

function safeDownloadDirectory(value) {
  const directory = expandHome(value);
  if (!directory) return "";
  try {
    const stats = fs.statSync(directory);
    return stats.isDirectory() ? directory : "";
  } catch {
    return "";
  }
}

function normalizePermissions(permissions) {
  return {
    notifications: normalizePermissionValue(permissions?.notifications, permissionPolicy.notifications),
    camera: normalizePermissionValue(permissions?.camera, permissionPolicy.camera),
    microphone: normalizePermissionValue(permissions?.microphone, permissionPolicy.microphone),
    media: normalizePermissionValue(permissions?.media, permissionPolicy.media),
    geolocation: normalizePermissionValue(permissions?.geolocation, permissionPolicy.geolocation)
  };
}

function normalizePreferences(preferences) {
  return {
    askDownloadLocation: preferences?.askDownloadLocation !== false,
    downloadsPath: String(preferences?.downloadsPath || "").trim()
  };
}

function readExtensionManifest(target) {
  const manifestPath = path.join(target, "manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Manifest Chrome invalide.");
  }
  if (!manifest.manifest_version || !manifest.name) {
    throw new Error("Manifest Chrome incomplet.");
  }
  return manifest;
}

async function loadExtensionFromPath(extensionPath) {
  const requestedPath = expandHome(extensionPath);
  if (!requestedPath) throw new Error("Dossier d'extension vide.");
  const target = fs.realpathSync(requestedPath);
  if (!target || !fs.existsSync(path.join(target, "manifest.json")) || !fs.statSync(target).isDirectory()) {
    throw new Error("Dossier invalide: manifest.json introuvable.");
  }
  readExtensionManifest(target);
  const existing = Array.from(loadedExtensions.values()).find((extension) => extension.path === target);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      enabled: true,
      status: "loaded",
      error: ""
    };
  }
  const extension = await session.defaultSession.loadExtension(target, { allowFileAccess: false });
  loadedExtensions.set(extension.id, { ...extension, path: target });
  return {
    id: extension.id,
    name: extension.name,
    path: target,
    enabled: true,
    status: "loaded",
    error: ""
  };
}

function createWindow() {
  const win = new BrowserWindow(windowOptions({
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      webviewTag: true
    }
  }));

  secureWindowOpen(win);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permissionAllowed(permission));
  });
  session.defaultSession.on("will-download", (_event, item) => {
    const directory = safeDownloadDirectory(downloadPolicy.downloadsPath);
    if (!downloadPolicy.askDownloadLocation && directory) {
      item.setSavePath(path.join(directory, safeDownloadFilename(item.getFilename())));
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("open-external", async (_event, url) => {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return false;
  await shell.openExternal(normalized);
  return true;
});

ipcMain.handle("copy-text", async (_event, text) => {
  clipboard.writeText(String(text || ""));
});

ipcMain.handle("open-new-window", async (_event, url) => {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return false;
  const win = new BrowserWindow(windowOptions({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 520
  }));
  secureWindowOpen(win);
  await win.loadURL(normalized);
  return true;
});

ipcMain.handle("set-permissions", async (_event, permissions) => {
  permissionPolicy = normalizePermissions(permissions || {});
  return permissionPolicy;
});

ipcMain.handle("set-preferences", async (_event, preferences) => {
  downloadPolicy = normalizePreferences(preferences || {});
  return downloadPolicy;
});

ipcMain.handle("choose-chrome-extension", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choisir un dossier d'extension Chrome unpacked",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return loadExtensionFromPath(result.filePaths[0]);
});

ipcMain.handle("load-chrome-extension", async (_event, extensionPath) => {
  return loadExtensionFromPath(extensionPath);
});

ipcMain.handle("unload-chrome-extension", async (_event, extensionId) => {
  const id = String(extensionId || "");
  if (!id || !loadedExtensions.has(id)) return { id, status: "not-loaded" };
  session.defaultSession.removeExtension(id);
  loadedExtensions.delete(id);
  return { id, status: "disabled" };
});

ipcMain.handle("list-chrome-extensions", async () => Array.from(loadedExtensions.values()).map((extension) => ({
  id: extension.id,
  name: extension.name,
  path: extension.path
})));
