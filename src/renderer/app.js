// ── CATALOG & DEFAULTS ──────────────────────────────────────────────────────

const colorFluo = ["#FF0000","#FF7700","#FFFF00","#00FF00","#00FFFF","#0077FF","#0000FF","#FF00FF","#FF00AA","#FFAA00"];
const colorPale = ["#FFB3B3","#FFD9B3","#FFFFB3","#B3FFB3","#B3FFFF","#B3D9FF","#B3B3FF","#FFB3FF","#FFB3D9","#FFD9B3"];

const appCatalog = [
  { id: "gmail",    name: "Gmail",    url: "https://mail.google.com",         color: "#d94f43" },
  { id: "github",   name: "GitHub",   url: "https://github.com",              color: "#24292f" },
  { id: "slack",    name: "Slack",    url: "https://slack.com/signin",        color: "#4a154b" },
  { id: "notion",   name: "Notion",   url: "https://www.notion.so",           color: "#111111" },
  { id: "calendar", name: "Calendar", url: "https://calendar.google.com",     color: "#3478f6" },
  { id: "linear",   name: "Linear",   url: "https://linear.app",              color: "#5e6ad2" },
  { id: "chatgpt",  name: "ChatGPT",  url: "https://chatgpt.com",             color: "#10a37f" }
];

const defaultWorkspaces = [
  { id: "work",     name: "Work",     icon: "W", color: "#2f80ed", backgroundColor: "transparent" },
  { id: "personal", name: "Personal", icon: "P", color: "#ffffff", backgroundColor: "transparent" },
  { id: "focus",    name: "Focus",    icon: "F", color: "#e5484d", backgroundColor: "transparent" }
];

const defaultAppsByWorkspace = {
  work:     appCatalog.slice(0, 5),
  personal: [appCatalog[3], appCatalog[6]],
  focus:    [appCatalog[4], appCatalog[5]]
};

// ── STATE ────────────────────────────────────────────────────────────────────

const STARTER = {
  density: "normal", skin: "biscuit",
  customSkin: { cream: "#f6f4ee", sidebar: "#eee8de", accent: "#e16f43" },
  settingsOpen: false, settingsSection: "general",
  maskUrl: false, groupIconSize: 22, appIconSize: 17,
  splitView: false, splitLeftAppId: "", splitRightAppId: "", splitOrientation: "horizontal",
  downloadsPath: "", askDownloadLocation: true,
  globalNotifications: true, notificationSound: false, notificationBadges: true,
  shortcutsEnabled: true, compactShortcuts: false,
  cameraPermission: "ask", microphonePermission: "ask", locationPermission: "ask",
  fontScale: 100, uiFont: "system", syncEnabled: false, adBlockEnabled: false,
  chromeExtensions: [], rssFeedsByTab: {},
  sidebarCollapsed: false, secretsHidden: false, showHiddenApps: false, hideCachableApps: false,
  workspaces: defaultWorkspaces, activeWorkspaceId: "work",
  appsByWorkspace: defaultAppsByWorkspace,
  activeAppByWorkspace: { work: "gmail", personal: "notion", focus: "calendar" },
  tabsByApp: {}
};

// Ephemeral UI state (not persisted)
let ui = { 
  menu: null, 
  propertiesAppId: null, 
  propertiesWorkspaceId: null, 
  shareDraft: null, 
  activeTabId: null, 
  toast: null, 
  groupMenuOpen: null,
  quickSwitcherOpen: false,
  quickSwitcherQuery: "",
  quickSwitcherIndex: 0,
  quickSwitcherResults: []
};

let S = loadState();
const root = document.getElementById("app");
let wvFrame = null; // persistent — never destroyed between renders
S.settingsOpen = false;

const D = {
  appById: new Map(),
  workspaceById: new Map(),
  workspaceIdByAppId: new Map(),
  tabById: new Map(),
  visibleWorkspaceApps: [],
  visibleWorkspaceAppsKey: ""
};

// Platform class — used by CSS to handle macOS traffic lights
if (navigator.userAgent.includes("Mac")) document.body.classList.add("platform-mac");

function loadState() {
  try {
    const raw = localStorage.getItem("crokETT.state") || localStorage.getItem("cookiers.state");
    const stored = JSON.parse(raw);
    return migrate(stored?.workspaces ? stored : STARTER);
  } catch { return migrate(STARTER); }
}

function rebuildDerived() {
  D.appById.clear();
  D.workspaceById.clear();
  D.workspaceIdByAppId.clear();
  D.tabById.clear();

  S.workspaces.forEach((workspace) => {
    D.workspaceById.set(workspace.id, workspace);
    (S.appsByWorkspace[workspace.id] || []).forEach((app) => {
      D.appById.set(app.id, app);
      D.workspaceIdByAppId.set(app.id, workspace.id);
    });
  });
  Object.values(S.tabsByApp || {}).forEach((tabs) => {
    tabs.forEach((tab) => D.tabById.set(tab.id, tab));
  });

  const visibleKey = JSON.stringify({
    showHiddenApps: S.showHiddenApps,
    hideCachableApps: S.hideCachableApps,
    workspaces: S.workspaces.map((workspace) => workspace.id),
    apps: Object.fromEntries(Object.entries(S.appsByWorkspace || {}).map(([workspaceId, apps]) => [
      workspaceId,
      (apps || []).map((app) => [app.id, Boolean(app.hidden), Boolean(app.cachable)])
    ]))
  });
  if (visibleKey !== D.visibleWorkspaceAppsKey) {
    D.visibleWorkspaceAppsKey = visibleKey;
    D.visibleWorkspaceApps = S.workspaces.flatMap((workspace) =>
      (S.appsByWorkspace[workspace.id] || [])
        .filter((app) => (S.showHiddenApps || !app.hidden) && (!S.hideCachableApps || !app.cachable))
        .map((app) => ({ workspaceId: workspace.id, app }))
    );
  }
}

function save() {
  rebuildDerived();
  localStorage.setItem("crokETT.state", JSON.stringify(S));
}

function commit() { save(); render(); }

function migrate(raw) {
  const s = structuredClone(raw);
  s.density ||= "normal"; s.skin ||= "biscuit"; s.customSkin ||= STARTER.customSkin;
  s.settingsOpen = false; s.settingsSection ||= "general";
  s.maskUrl = Boolean(s.maskUrl);
  s.groupIconSize = clamp(s.groupIconSize, 14, 72, 22);
  s.appIconSize   = clamp(s.appIconSize,   12, 58, 17);
  s.splitView = Boolean(s.splitView); s.splitLeftAppId ||= ""; s.splitRightAppId ||= "";
  s.splitOrientation = ["horizontal","vertical"].includes(s.splitOrientation) ? s.splitOrientation : "horizontal";
  s.downloadsPath ||= ""; s.askDownloadLocation = s.askDownloadLocation !== false;
  s.globalNotifications = s.globalNotifications !== false;
  s.notificationSound = Boolean(s.notificationSound); s.notificationBadges = s.notificationBadges !== false;
  s.shortcutsEnabled = s.shortcutsEnabled !== false; s.compactShortcuts = Boolean(s.compactShortcuts);
  s.cameraPermission = normPerm(s.cameraPermission); s.microphonePermission = normPerm(s.microphonePermission);
  s.locationPermission = normPerm(s.locationPermission);
  s.fontScale = clamp(s.fontScale, 80, 130, 100);
  s.uiFont = ["system","sans","serif","mono"].includes(s.uiFont) ? s.uiFont : "system";
  s.syncEnabled = Boolean(s.syncEnabled); s.adBlockEnabled = Boolean(s.adBlockEnabled);
  s.chromeExtensions = (s.chromeExtensions || [])
    .map(e => ({ id:"", name:"Extension Chrome", path:"", enabled:true, status:"pending", error:"", ...e }))
    .filter(e => e.path);
  s.rssFeedsByTab ||= {};
  s.sidebarCollapsed = Boolean(s.sidebarCollapsed);
  if (!s.layoutV4CompactApplied) { s.groupIconSize = 22; s.appIconSize = 17; s.layoutV4CompactApplied = true; }
  s.secretsHidden = Boolean(s.secretsHidden); s.showHiddenApps = Boolean(s.showHiddenApps);
  s.hideCachableApps = Boolean(s.hideCachableApps);

  // Workspaces
  const wsList = Array.isArray(s.workspaces) ? s.workspaces.filter(w => w && typeof w === "object") : [];
  const wsById = new Map(wsList.map(w => [w.id, w]));
  const merged = defaultWorkspaces.map((w, i) => ({
    color: defaultWorkspaces[i]?.color || "#f8f3ea", highlightColor: "", iconImage: "", backgroundColor: "transparent",
    priority: i + 1, shortcut: "", collapsed: false, ...w, ...(wsById.get(w.id) || {})
  }));
  defaultWorkspaces.forEach((w, i) => { if (merged[i]) merged[i].color = w.color; });
  const extras = wsList.filter(w => !defaultWorkspaces.some(d => d.id === w.id));
  s.workspaces = [...merged, ...extras].map(ws => ({ ...ws, backgroundColor: ws.backgroundColor || "transparent" }));

  // Apps
  s.appsByWorkspace ||= {};
  defaultWorkspaces.forEach(w => {
    if (!Array.isArray(s.appsByWorkspace[w.id]) || !s.appsByWorkspace[w.id].length)
      s.appsByWorkspace[w.id] = structuredClone(defaultAppsByWorkspace[w.id] || []);
  });
  Object.keys(s.appsByWorkspace).forEach(wid => {
    const apps = Array.isArray(s.appsByWorkspace[wid]) ? s.appsByWorkspace[wid] : [];
    s.appsByWorkspace[wid] = apps.map(a => ({
      notifications: true, notificationCount: 0, hidden: false, cachable: false,
      priority: 0, secret: false, maskUrl: false, iconImage: "", highlightColor: "", color: "#e16f43",
      backgroundColor: "transparent",
      ...a
    }));
  });

  s.activeWorkspaceId = s.workspaces.some(w => w.id === s.activeWorkspaceId)
    ? s.activeWorkspaceId : s.workspaces[0]?.id;
  s.activeAppByWorkspace ||= {};
  s.workspaces.forEach(w => {
    const apps = s.appsByWorkspace[w.id] || [];
    if (!apps.some(a => a.id === s.activeAppByWorkspace[w.id]))
      s.activeAppByWorkspace[w.id] = apps[0]?.id || null;
  });

  s.tabsByApp ||= {};
  Object.keys(s.tabsByApp).forEach(aid => {
    s.tabsByApp[aid] = s.tabsByApp[aid].map(t => ({ secret: false, muted: false, pinned: false, ...t }));
  });
  return s;
}

rebuildDerived();

// ── HELPERS ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function clamp(v, min, max, def) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; }
function normPerm(v) { return ["ask","allow","block"].includes(v) ? v : "ask"; }
function normUrl(v) {
  const t = String(v || "").trim();
  if (!t) return "about:blank";
  if (/^https?:\/\//i.test(t) || t.startsWith("about:")) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}
function hostname(url) { try { return new URL(normUrl(url)).hostname; } catch { return ""; } }
function favicon(url) { const d = hostname(url); return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : ""; }
function initials(name) { return String(name).split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase(); }

// ── QUERIES ───────────────────────────────────────────────────────────────────

function activeWorkspace() { return D.workspaceById.get(S.activeWorkspaceId) || S.workspaces[0]; }
function activeApps()      { return S.appsByWorkspace[S.activeWorkspaceId] || []; }
function visibleApps() {
  return activeApps().filter(a => {
    if (!S.showHiddenApps && a.hidden) return false;
    if (S.hideCachableApps && a.cachable) return false;
    return true;
  });
}
function activeApp() {
  const apps = visibleApps();
  const id = S.activeAppByWorkspace[S.activeWorkspaceId] || apps[0]?.id;
  return apps.find(a => a.id === id) || apps[0];
}
function findApp(id)       { return D.appById.get(id); }
function findWorkspace(id) { return D.workspaceById.get(id); }
function findWorkspaceForApp(appId) {
  return D.workspaceIdByAppId.get(appId);
}
function findTabById(tabId) {
  return D.tabById.get(tabId) || null;
}
function tabsFor(appId) {
  if (!S.tabsByApp[appId]) {
    const app = [...appCatalog, ...activeApps()].find(a => a.id === appId);
    const tab = { id:`${appId}-${Date.now()}`, title: app?.name || "Nouvel onglet", url: app?.url || "about:blank", secret: false, muted: false, pinned: false };
    S.tabsByApp[appId] = [tab];
    D.tabById.set(tab.id, tab);
  }
  return S.tabsByApp[appId];
}
function visibleTabs(appId) {
  return S.secretsHidden ? tabsFor(appId).filter(t => !t.secret) : tabsFor(appId);
}
function activeTab() {
  const app = activeApp();
  if (!app) return null;
  const tabs = visibleTabs(app.id);
  if (!tabs.length) { ui.activeTabId = null; return null; }
  const t = tabs.find(t => t.id === ui.activeTabId) || tabs[0];
  ui.activeTabId = t.id;
  return t;
}
function visibleWorkspaceApps() {
  return D.visibleWorkspaceApps;
}
function splitPane(side) {
  if (!S.splitView) return null;
  const apps = visibleWorkspaceApps();
  if (!apps.length) return null;
  const savedId = side === "left" ? S.splitLeftAppId : S.splitRightAppId;
  const saved = apps.find(i => i.app.id === savedId);
  if (saved) return saved;
  if (side === "left") { const cur = activeApp(); return apps.find(i => i.app.id === cur?.id) || apps[0]; }
  const left = splitPane("left");
  const li = apps.findIndex(i => i.app.id === left?.app.id);
  return apps[(li + 1 + apps.length) % apps.length] || null;
}
function splitTabFor(app) {
  if (!app) return null;
  return visibleTabs(app.id)[0] || tabsFor(app.id)[0] || null;
}
function partition(appId, partitionKey, tab) {
  // Chaque app a son propre container sauf si elle partage une partitionKey (cas duplication)
  if (tab.secret) return `persist:crokETT-secret-${tab.id}`;
  return `persist:crokETT-app-${partitionKey || appId}`;
}
function badge(app) {
  if (!S.notificationBadges || !app.notifications || !app.notificationCount) return "";
  return `<span class="notification-badge">${app.notificationCount > 99 ? "99+" : app.notificationCount}</span>`;
}

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

function selectWorkspace(id) {
  S.activeWorkspaceId = id;
  const app = activeApp();
  ui.activeTabId = app ? visibleTabs(app.id)[0]?.id || null : null;
  ui.menu = null;
  commit();
}
function selectApp(appId, workspaceId) {
  if (workspaceId) S.activeWorkspaceId = workspaceId;
  S.activeAppByWorkspace[S.activeWorkspaceId] = appId;
  if (S.splitView) S.splitLeftAppId = appId;
  ui.activeTabId = visibleTabs(appId)[0]?.id || null;
  ui.menu = null;
  commit();
}
function selectTab(id) {
  ui.activeTabId = id; ui.menu = null; render();
}
function doCloseTab(id) {
  const app = activeApp(); if (!app) return;
  const tabs = tabsFor(app.id);
  if (tabs.length === 1) return;
  S.tabsByApp[app.id] = tabs.filter(t => t.id !== id);
  ui.activeTabId = visibleTabs(app.id)[0]?.id || null;
  commit();
}
function createTab(url, secret = false) {
  const app = activeApp(); if (!app) return;
  const tab = { id:`${app.id}-${Date.now()}`, title: secret ? "Secret" : "Nouvel onglet", url: normUrl(url || app.url), secret, muted: false, pinned: false };
  S.tabsByApp[app.id] = [...tabsFor(app.id), tab];
  ui.activeTabId = tab.id; S.secretsHidden = false; commit();
}
function createTabInApp(appId, url) {
  const wid = findWorkspaceForApp(appId); if (!wid) return;
  const app = (S.appsByWorkspace[wid] || []).find(a => a.id === appId); if (!app) return;
  const tab = { id:`${appId}-${Date.now()}`, title:"Nouvel onglet", url: normUrl(url || app.url), secret: false, muted: false, pinned: false };
  S.tabsByApp[appId] = [...tabsFor(appId), tab];
  S.activeWorkspaceId = wid; S.activeAppByWorkspace[wid] = appId; ui.activeTabId = tab.id; commit();
}
function closeOtherTabs(id) {
  const app = activeApp(); if (!app) return;
  const t = tabsFor(app.id).find(t => t.id === id); if (!t) return;
  S.tabsByApp[app.id] = [t]; ui.activeTabId = id; commit();
}
function closeTabsToRight(id) {
  const app = activeApp(); if (!app) return;
  const tabs = tabsFor(app.id);
  const idx = tabs.findIndex(t => t.id === id); if (idx < 0) return;
  S.tabsByApp[app.id] = tabs.slice(0, idx + 1);
  if (!S.tabsByApp[app.id].some(t => t.id === ui.activeTabId)) ui.activeTabId = id;
  commit();
}
function toggleTabMuted(id) { const t = findTabById(id); if (!t) return; t.muted = !t.muted; commit(); }
function toggleTabPinned(id) { const t = findTabById(id); if (!t) return; t.pinned = !t.pinned; commit(); }
function renamePinnedTab(id) {
  const t = findTabById(id); if (!t?.pinned) return;
  const title = window.prompt("Nom de l'onglet épinglé", t.title || "");
  if (title === null) return;
  t.title = title.trim() || t.title; commit();
}
function updateActiveTabUrl(url) {
  const app = activeApp(); const tab = activeTab(); if (!app || !tab) return;
  tab.url = normUrl(url); tab.title = tab.url.replace(/^https?:\/\//,"").replace(/\/$/,""); commit();
}
function toggleActiveTabSecret() {
  const t = activeTab(); if (!t) return;
  t.secret = !t.secret; if (t.secret) S.secretsHidden = false; commit();
}
function toggleSecretsHidden() {
  S.secretsHidden = !S.secretsHidden;
  const app = activeApp();
  if (app) { const tabs = visibleTabs(app.id); if (tabs.length) ui.activeTabId = tabs[0].id; }
  commit();
}
function setSplitPaneApp(side, appId) {
  const wid = findWorkspaceForApp(appId); if (!wid) return;
  if (side === "left") {
    S.splitLeftAppId = appId; S.activeWorkspaceId = wid;
    S.activeAppByWorkspace[wid] = appId;
    ui.activeTabId = visibleTabs(appId)[0]?.id || tabsFor(appId)[0]?.id || null;
  }
  if (side === "right") S.splitRightAppId = appId;
  commit();
}
function toggleSplitView() {
  S.splitView = !S.splitView;
  if (S.splitView) {
    const l = splitPane("left"), r = splitPane("right");
    S.splitLeftAppId = l?.app.id || activeApp()?.id || "";
    S.splitRightAppId = r?.app.id || "";
  }
  commit();
}
function splitAppToPane(appId, side) {
  if (!findWorkspaceForApp(appId)) return;
  if (!S.splitView) {
    S.splitView = true;
    S.splitLeftAppId = activeApp()?.id || appId;
    S.splitRightAppId = appId;
  }
  setSplitPaneApp(side, appId);
}
function updateSplitPaneUrl(side, url) {
  const pane = splitPane(side); if (!pane?.app) return;
  const tab = splitTabFor(pane.app); if (!tab) return;
  tab.url = normUrl(url); tab.title = tab.url.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if (side === "left") { S.activeWorkspaceId = pane.workspaceId; S.activeAppByWorkspace[pane.workspaceId] = pane.app.id; ui.activeTabId = tab.id; }
  commit();
}
function addWorkspace() {
  const id = `group-${Date.now()}`;
  const ws = { id, name:`Groupe ${S.workspaces.length + 1}`, icon: String(S.workspaces.length + 1).slice(-1), iconImage:"", color:"#f8f3ea", backgroundColor:"transparent", highlightColor:"", priority: S.workspaces.length + 1, shortcut:"", collapsed: false };
  S.workspaces = [...S.workspaces, ws];
  S.appsByWorkspace[id] = []; S.activeAppByWorkspace[id] = null; S.activeWorkspaceId = id;
  ui.propertiesWorkspaceId = id; commit();
}
function addCustomApp({ name, url }) {
  const normalized = normUrl(url);
  const id = `${String(name).toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${Date.now()}`;
  const app = { id, name: String(name).trim() || "App", url: normalized, color:"#e16f43", backgroundColor:"transparent", highlightColor:"", iconImage:"", notifications:true, notificationCount:0, hidden:false, cachable:false, priority:0, secret:false, maskUrl:false };
  S.appsByWorkspace[S.activeWorkspaceId] = [...activeApps(), app];
  S.activeAppByWorkspace[S.activeWorkspaceId] = id;
  S.tabsByApp[id] = [{ id:`${id}-home`, title: app.name, url: normalized, secret: false, muted: false, pinned: false }];
  ui.activeTabId = `${id}-home`; commit();
}
function updateAppProperties(appId, fd) {
  const app = findApp(appId); if (!app) return;
  app.name = String(fd.get("name") || app.name).trim();
  app.url = normUrl(fd.get("url")); app.color = String(fd.get("color") || app.color);
  app.backgroundColor = String(fd.get("backgroundColor") || "transparent");
  app.highlightColor = String(fd.get("highlightColor") || ""); app.iconImage = String(fd.get("iconImage") || "").trim();
  app.notifications = fd.get("notifications") === "on"; app.notificationCount = Number(fd.get("notificationCount") || 0);
  app.priority = Number(fd.get("priority") || 0); app.cachable = fd.get("cachable") === "on";
  app.hidden = fd.get("hidden") === "on"; app.secret = fd.get("secret") === "on"; app.maskUrl = fd.get("maskUrl") === "on";
  const ht = tabsFor(appId)[0]; if (ht) { ht.title = app.name; ht.url = app.url; ht.secret = app.secret; }
  ui.propertiesAppId = null; commit();
}
function deleteApp(appId) {
  const apps = activeApps(); if (apps.length <= 1) return;
  const app = findApp(appId);
  if (!confirm(`Supprimer "${app?.name || appId}" ?\nCette action est irréversible.`)) return;
  S.appsByWorkspace[S.activeWorkspaceId] = apps.filter(a => a.id !== appId);
  delete S.tabsByApp[appId];
  S.activeAppByWorkspace[S.activeWorkspaceId] = S.appsByWorkspace[S.activeWorkspaceId][0]?.id || null;
  ui.activeTabId = visibleTabs(S.activeAppByWorkspace[S.activeWorkspaceId])[0]?.id || null;
  commit();
}
function duplicateApp(appId) {
  const app = findApp(appId); if (!app) return;
  // La copie hérite la partitionKey de l'original pour partager les cookies
  const sharedKey = app.partitionKey || appId;
  const copy = { ...app, id:`${appId}-copy-${Date.now()}`, name:`${app.name} 2`, hidden: false, partitionKey: sharedKey };
  S.appsByWorkspace[S.activeWorkspaceId] = [...activeApps(), copy];
  S.tabsByApp[copy.id] = [{ id:`${copy.id}-home`, title: copy.name, url: copy.url, secret: false, muted: false, pinned: false }];
  selectApp(copy.id);
}
function toggleAppHidden(appId) {
  const app = findApp(appId); if (!app) return;
  app.hidden = !app.hidden;
  if (app.hidden && S.activeAppByWorkspace[S.activeWorkspaceId] === appId) {
    const next = visibleApps().find(a => a.id !== appId);
    if (next) S.activeAppByWorkspace[S.activeWorkspaceId] = next.id;
  }
  commit();
}
function updateWorkspaceProperties(wid, fd) {
  const ws = findWorkspace(wid); if (!ws) return;
  ws.name = String(fd.get("name") || ws.name).trim();
  ws.icon = String(fd.get("icon") || ws.icon).trim().slice(0,2).toUpperCase();
  ws.iconImage = String(fd.get("iconImage") || "").trim();
  ws.color = String(fd.get("color") || ws.color); 
  ws.backgroundColor = String(fd.get("backgroundColor") || "transparent");
  ws.priority = Number(fd.get("priority") || 0); ws.shortcut = String(fd.get("shortcut") || "").trim();
  ws.collapsed = fd.get("collapsed") === "on";
  ui.propertiesWorkspaceId = null; commit();
}
function toggleWorkspaceCollapsed(wid) {
  const ws = findWorkspace(wid); if (!ws) return;
  ws.collapsed = !ws.collapsed; commit();
}
function moveWorkspace(srcId, tgtId) {
  if (srcId === tgtId) return;
  const si = S.workspaces.findIndex(w => w.id === srcId);
  const ti = S.workspaces.findIndex(w => w.id === tgtId);
  if (si < 0 || ti < 0) return;
  const [item] = S.workspaces.splice(si, 1);
  S.workspaces.splice(ti, 0, item); commit();
}
function moveApp(srcId, tgtId) {
  if (srcId === tgtId) return;
  const sw = findWorkspaceForApp(srcId) || S.activeWorkspaceId;
  const tw = findWorkspaceForApp(tgtId) || S.activeWorkspaceId;
  const sa = S.appsByWorkspace[sw] || [];
  const si = sa.findIndex(a => a.id === srcId);
  const ta = S.appsByWorkspace[tw] || [];
  const ti = ta.findIndex(a => a.id === tgtId);
  if (si < 0 || ti < 0) return;
  const [item] = sa.splice(si, 1);
  const adj = sw === tw && si < ti ? ti - 1 : ti;
  ta.splice(adj, 0, item);
  S.appsByWorkspace[sw] = sa; S.appsByWorkspace[tw] = ta;
  S.activeWorkspaceId = tw; S.activeAppByWorkspace[tw] = srcId; commit();
}
function moveAppToWorkspace(srcId, twid) {
  const swid = findWorkspaceForApp(srcId);
  if (!swid || !twid || swid === twid) return;
  const sa = S.appsByWorkspace[swid] || [];
  const si = sa.findIndex(a => a.id === srcId); if (si < 0) return;
  const [item] = sa.splice(si, 1);
  S.appsByWorkspace[twid] = [...(S.appsByWorkspace[twid] || []), item];
  S.appsByWorkspace[swid] = sa; S.activeWorkspaceId = twid; S.activeAppByWorkspace[twid] = item.id; commit();
}
function incrementNotification(appId) {
  if (!S.globalNotifications) return;
  const app = findApp(appId); if (!app || !app.notifications) return;
  app.notificationCount = Number(app.notificationCount || 0) + 1; commit();
}
function exportConfig() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `crokETT-config-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
function importConfig(file) {
  if (!file) return;
  if (!confirm("Importer ce fichier remplacera toute la configuration actuelle.\nContinuer ?")) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { S = migrate(JSON.parse(String(reader.result || ""))); ui.activeTabId = null; commit(); }
    catch { showToast("Fichier JSON invalide ou corrompu.", "error"); }
  };
  reader.readAsText(file);
}
function syncNative() {
  window.crokETT?.setPermissions?.({
    notifications: S.globalNotifications ? "allow" : "block",
    camera: S.cameraPermission, microphone: S.microphonePermission,
    media: S.cameraPermission === "block" || S.microphonePermission === "block" ? "block" : "ask",
    geolocation: S.locationPermission
  });
  window.crokETT?.setPreferences?.({ askDownloadLocation: S.askDownloadLocation, downloadsPath: S.downloadsPath });
}
function shareTo(target) {
  if (!ui.shareDraft) return;
  const text = shareText();
  if (target === "copy") { window.crokETT.copyText(text); ui.shareDraft = null; render(); return; }
  if (target === "x") window.crokETT.openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
  if (target === "whatsapp") window.crokETT.openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
  if (target === "linkedin") window.crokETT.openExternal(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ui.shareDraft.url)}`);
  if (target === "mail") window.crokETT.openExternal(`mailto:?subject=${encodeURIComponent(ui.shareDraft.title)}&body=${encodeURIComponent(text)}`);
}

async function openShare() {
  const tab = activeTab(); if (!tab) return;
  ui.shareDraft = { text:"", title: tab.title, url: tab.url };
  ui.menu = null; render();
  const wv = document.querySelector("webview.active");
  if (!wv) return;
  try {
    const sel = await Promise.race([
      wv.executeJavaScript("String(window.getSelection?.()?.toString() || '')"),
      new Promise(r => setTimeout(() => r(""), 450))
    ]);
    if (ui.shareDraft?.url === tab.url) { ui.shareDraft.text = String(sel || "").trim(); render(); }
  } catch { render(); }
}
function showToast(msg, type = "info") {
  const at = Date.now();
  ui.toast = { msg, type, at };
  render();
  setTimeout(() => { if (ui.toast?.at === at) { ui.toast = null; render(); } }, 4000);
}
function renderToast() {
  if (!ui.toast) return "";
  return `<div class="toast toast-${esc(ui.toast.type)}" data-close-toast>${esc(ui.toast.msg)}</div>`;
}
function applyAdBlock(wv) {
  if (!S.adBlockEnabled) return;
  wv.insertCSS(`[id*="ad-"],[class*=" ad-"],[class^="ad-"],[class*=" ads"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],[aria-label*="advertisement" i],[aria-label*="publicité" i]{display:none!important}`).catch(()=>{});
}
function injectWebviewFont(wv) {
  if (!S.uiFont || S.uiFont === "system") return;
  const map = { sans: "'Helvetica Neue',Arial,sans-serif", serif: "Georgia,'Times New Roman',serif", mono: "'Courier New',Courier,monospace" };
  const fam = map[S.uiFont]; if (!fam) return;
  wv.insertCSS(`body,p,div,span,a,h1,h2,h3,h4,h5,h6,button,input,textarea,select{font-family:${fam}!important}`).catch(()=>{});
}
function hookNotifications(wv) {
  wv.executeJavaScript(`(()=>{if(window.__crokETTHooked||!window.Notification)return;window.__crokETTHooked=true;const N=window.Notification;const r=p=>{try{console.info("__CROKETTS_NOTIFICATION__"+JSON.stringify(p||{}))}catch{}};function W(t,o){r({title:String(t||""),body:String((o&&o.body)||"")});return new N(t,o)}W.permission=N.permission;W.requestPermission=(...a)=>N.requestPermission(...a);W.prototype=N.prototype;try{Object.defineProperty(window,"Notification",{configurable:true,writable:true,value:W})}catch{}})()`).catch(()=>{});
}
async function loadChromeExtension() {
  try {
    const ext = await window.crokETT.chooseChromeExtension(); if (!ext) return;
    S.chromeExtensions = [...S.chromeExtensions.filter(e => e.id !== ext.id), ext]; commit();
  } catch(e) { showToast(`Extension non chargée : ${e?.message || e}`, "error"); }
}
async function setChromeExtEnabled(id, enabled) {
  const ext = S.chromeExtensions.find(e => e.id === id); if (!ext) return;
  ext.enabled = enabled;
  try {
    if (enabled) { const loaded = await window.crokETT.loadChromeExtension(ext.path); Object.assign(ext, loaded); }
    else { await window.crokETT.unloadChromeExtension(id); ext.status = "disabled"; ext.error = ""; }
  } catch(e) { ext.status = "error"; ext.error = e?.message || String(e); }
  commit();
}
async function removeChromeExtension(id) {
  const ext = S.chromeExtensions.find(e => e.id === id);
  if (ext?.id) await window.crokETT.unloadChromeExtension(ext.id).catch(()=>{});
  S.chromeExtensions = S.chromeExtensions.filter(e => e.id !== id); commit();
}

function updateQuickSwitcherResults() {
  const query = ui.quickSwitcherQuery.toLowerCase().trim();
  const results = [];

  S.workspaces.forEach(ws => {
    if (ws.name.toLowerCase().includes(query)) {
      results.push({ kind: "workspace", id: ws.id, name: ws.name, icon: ws.icon, iconImage: ws.iconImage, color: ws.color });
    }
    const apps = S.appsByWorkspace[ws.id] || [];
    apps.forEach(app => {
      if (app.name.toLowerCase().includes(query) || app.url.toLowerCase().includes(query)) {
        results.push({ kind: "app", id: app.id, workspaceId: ws.id, name: app.name, url: app.url, color: app.color, iconImage: app.iconImage });
      }
    });
  });

  ui.quickSwitcherResults = results.slice(0, 10);
  ui.quickSwitcherIndex = Math.min(ui.quickSwitcherIndex, Math.max(0, ui.quickSwitcherResults.length - 1));
}

function renderQuickSwitcher() {
  if (!ui.quickSwitcherOpen) return "";
  return `
    <div class="quick-switcher-backdrop" data-close-switcher>
      <div class="quick-switcher">
        <div class="quick-switcher-input-wrap">
          <input type="text" placeholder="Rechercher une app ou un workspace..." data-switcher-input value="${esc(ui.quickSwitcherQuery)}" autofocus />
        </div>
        <div class="quick-switcher-results">
          ${ui.quickSwitcherResults.length ? ui.quickSwitcherResults.map((r, i) => {
            const selected = i === ui.quickSwitcherIndex;
            const icon = r.iconImage || (r.kind === "app" ? favicon(r.url) : "");
            return `
              <div class="quick-result${selected ? " selected" : ""}" data-switcher-select="${i}">
                <div class="quick-result-icon" style="background:${esc(r.color || "var(--bg-tertiary)")}">
                  ${icon ? `<img src="${esc(icon)}" alt="" />` : `<span class="group-glyph">${esc(r.icon || initials(r.name))}</span>`}
                </div>
                <div class="quick-result-info">
                  <span class="quick-result-title">${esc(r.name)}</span>
                  <span class="quick-result-meta">${esc(r.kind === "workspace" ? "Workspace" : hostname(r.url))}</span>
                </div>
                <div class="quick-result-hint">${esc(r.kind)}</div>
              </div>`;
          }).join("") : `<div class="empty-settings">Aucun résultat.</div>`}
        </div>
      </div>
    </div>`;
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function applyChrome() {
  document.body.className = `density-${S.density} skin-${S.skin}`;
  const skin = S.skin === "custom" ? S.customSkin : null;
  document.body.style.setProperty("--custom-cream",   skin?.cream   || "");
  document.body.style.setProperty("--custom-sidebar", skin?.sidebar || "");
  document.body.style.setProperty("--custom-accent",  skin?.accent  || "");
  document.body.style.setProperty("--group-icon-size",`${S.groupIconSize}px`);
  document.body.style.setProperty("--app-icon-size",  `${S.appIconSize}px`);
  document.body.style.setProperty("--font-scale",     `${S.fontScale / 100}`);
  const _fontMap = { system: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", sans: "'Helvetica Neue',Arial,sans-serif", serif: "Georgia,'Times New Roman',serif", mono: "'Courier New',Courier,monospace" };
  document.body.style.setProperty("--ui-font", _fontMap[S.uiFont] || _fontMap.system);
}

function render() {
  applyChrome();
  const ws    = activeWorkspace();
  const app   = activeApp();
  const tab   = activeTab();
  const vtabs = app ? visibleTabs(app.id) : [];
  const lPane = splitPane("left"),  rPane = splitPane("right");
  const lApp  = lPane?.app || app;
  const lTab  = splitTabFor(lApp) || tab, rTab = splitTabFor(rPane?.app);
  const maskUrl = S.maskUrl || Boolean(app?.maskUrl);
  const splitReady = Boolean(S.splitView && lPane && rPane && lTab && rTab);
  const shellCls = ["shell", S.sidebarCollapsed?"sidebar-icons":"", S.secretsHidden?"secrets-hidden":"", S.maskUrl?"url-masked":"", splitReady?"split-view":"", splitReady&&S.splitOrientation==="vertical"?"split-bottom":""].filter(Boolean).join(" ");
  const menu = ui.menu;

  // First render: build the persistent skeleton. wvFrame is created once and never destroyed.
  if (!wvFrame) {
    root.innerHTML = `<main></main><div id="overlays"></div>`;
    root.querySelector("main").innerHTML = `
      <aside class="app-sidebar unified-sidebar"></aside>
      <section class="browser">
        <div class="toolbar"></div>
        <div class="tabbar"></div>
        <div class="web-stage"><div class="web-frame"></div></div>
      </section>`;
    wvFrame = root.querySelector(".web-frame");
  }

  // Update shell class
  root.querySelector("main").className = shellCls;

  // Update sidebar
  root.querySelector(".app-sidebar").innerHTML = `
    <section class="sidebar-section">
      ${S.workspaces.map((g, gi) => {
        const gApps = (S.appsByWorkspace[g.id] || []).filter(a => (S.showHiddenApps || !a.hidden) && (!S.hideCachableApps || !a.cachable));
        const col = Boolean(g.collapsed);
        const isActive = g.id === ws.id;
        const bgStyle = g.backgroundColor && g.backgroundColor !== "transparent" ? `background-color:${esc(g.backgroundColor)}` : "";
        return `
          <div class="unified-group" data-ws-drop="${esc(g.id)}" style="${bgStyle}">
            <div class="unified-group-row${isActive?" active":""}" data-ws="${esc(g.id)}">
              <span class="outliner-toggle">${col?"▸":"▾"}</span>
              <div class="unified-group-title">
                ${g.iconImage?`<img src="${esc(g.iconImage)}" alt="" />`:`<span class="group-glyph">${esc(g.icon||"")}</span>`}
                <span>${esc(g.name)}</span>
                ${gApps.length?`<small style="color:var(--text-tertiary); font-weight:500; font-size:10px; margin-left:auto">${gApps.length}</small>`:""}
              </div>
              <button class="group-menu-btn" data-group-menu-btn="${esc(g.id)}">⋮</button>
            </div>
            <div class="app-list"${col?" hidden":""}>
              ${gApps.map(a => {
                const icon = a.iconImage || favicon(a.url);
                const isAppActive = isActive && app?.id === a.id;
                const isClone = Boolean(a.partitionKey && a.partitionKey !== a.id);
                const appBgStyle = a.backgroundColor && a.backgroundColor !== "transparent" ? `background-color:${esc(a.backgroundColor)}` : "";
                return `
                  <button class="app-button${isAppActive?" active":""}${a.hidden?" hidden-app":""}" draggable="true" data-ws-app="${esc(g.id)}:${esc(a.id)}" style="${appBgStyle}">
                    <span class="app-icon" style="background:${esc(a.color)}">${icon?`<img src="${esc(icon)}" alt="" />`:`${esc(initials(a.name))}`}</span>
                    <span class="app-name">${esc(a.name)}</span>
                    ${isClone?`<span class="clone-badge" title="Clone">⊕</span>`:""}
                    ${badge(a)}
                  </button>`;
              }).join("")}
            </div>
          </div>`;
      }).join("")}
    </section>
    <div class="cookie-footer">
      <button data-add-ws>+ Groupe</button>
      <button data-open-add>+ App</button>
      <button data-toggle-cachable>${S.hideCachableApps?"Afficher":"Masquer"}</button>
      <button data-open-settings="general">Réglages</button>
    </div>`;

  // Update toolbar
  root.querySelector(".toolbar").innerHTML = `
    <div class="nav-controls">
      <button class="icon-button" data-nav="back">←</button>
      <button class="icon-button" data-nav="forward">→</button>
      <button class="icon-button" data-nav="reload">↻</button>
    </div>
    <form class="address-form" data-url-form>
      <input name="url" value="${esc(maskUrl ? hostname(tab?.url||"") : tab?.url||"")}" autocomplete="off" spellcheck="false" ${maskUrl?"readonly":""} />
    </form>
    <div class="right-controls">
      <button class="icon-button" data-new-tab>+</button>
      <button class="icon-button" data-share>⇪</button>
      <button class="icon-button${splitReady?" armed":""}" data-split-toggle>Ⅱ</button>
      <button class="icon-button" data-page-menu-btn>☰</button>
      <button class="icon-button" data-appbar-menu-btn>⊙</button>
      <button class="icon-button" data-external>↗</button>
    </div>`;

  // Update tabbar
  root.querySelector(".tabbar").innerHTML = vtabs.map(t => `
    <button class="tab${t.id===ui.activeTabId?" active":""}${t.secret?" secret":""}${t.pinned?" pinned":""}${t.muted?" muted":""}" data-tab="${esc(t.id)}">
      <span class="tab-title">
        ${t.pinned?`<span class="tab-flag tab-flag-pin">▲</span>`:""}
        ${t.muted?`<span class="tab-flag tab-flag-mute">◉</span>`:""}
        ${t.secret?`<span class="tab-flag tab-flag-secret">◈</span>`:""}
        ${esc(t.title)}
      </span>
      <span class="tab-menu-trigger" data-tab-menu="${esc(t.id)}">⌄</span>
      <span class="tab-close" data-close-tab="${esc(t.id)}">×</span>
    </button>`).join("");

  // Update overlays (modals + context menus) — webviews are never inside here
  document.getElementById("overlays").innerHTML = `
    ${renderAddModal()}
    ${renderPropertiesModal()}
    ${renderWorkspaceModal()}
    ${renderShareModal()}
    ${renderSettings()}
    ${renderContextMenu(menu)}
    ${renderTabMenu(menu)}
    ${renderWorkspaceMenu(menu)}
    ${renderPageMenu(menu)}
    ${renderAppBarMenu(menu)}
    ${renderToast()}
    ${renderQuickSwitcher()}
  `;

  // Update webviews without ever detaching them from the DOM
  syncWebviews(wvFrame, ws, app, splitReady, lPane, lTab, rPane, rTab);
  wireWebviews();
}

function syncWebviews(frame, ws, app, splitReady, lPane, lTab, rPane, rTab) {
  if (!frame) return;
  frame.className = `web-frame${splitReady ? " split-frame" : ""}`;

  if (splitReady) {
    const lTabId = lTab?.id || "", rTabId = rTab?.id || "";

    for (const side of ["left", "right"]) {
      const pane = side === "left" ? lPane : rPane;
      const pTab = side === "left" ? lTab  : rTab;

      // Find or create section
      let section = frame.querySelector(`[data-split-pane="${side}"]`);
      if (!section) {
        section = document.createElement("section");
        section.className = "split-pane";
        section.dataset.splitPane = side;
        frame.appendChild(section);
      }

      // Update toolbar IN PLACE — never destroy it (destroying causes layout jump → flash)
      let toolbar = section.querySelector(".split-pane-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.className = "split-pane-toolbar";
        section.insertBefore(toolbar, section.firstChild);
      }
      const apps = visibleWorkspaceApps();
      const selId = pane?.app?.id || "";
      // Rebuild select only if app list changed
      const select = toolbar.querySelector("select");
      if (!select || select.dataset.splitSelect !== side || select.value !== selId) {
        const newSel = document.createElement("select");
        newSel.dataset.splitSelect = side;
        newSel.innerHTML = apps.map(i => `<option value="${esc(i.app.id)}"${i.app.id===selId?" selected":""}>${esc(i.app.name)}</option>`).join("");
        if (select) select.replaceWith(newSel);
        else toolbar.insertBefore(newSel, toolbar.firstChild);
      }
      // Update URL input value without recreating the element
      let urlForm = toolbar.querySelector("form");
      if (!urlForm) {
        urlForm = document.createElement("form");
        urlForm.dataset.splitUrl = side;
        const inp = document.createElement("input");
        inp.name = "url"; inp.autocomplete = "off"; inp.spellcheck = false;
        urlForm.appendChild(inp);
        toolbar.appendChild(urlForm);
      }
      const urlInput = urlForm.querySelector("input");
      if (urlInput && document.activeElement !== urlInput) urlInput.value = pTab?.url || "";

      // Webview: always find by tab ID — never by "any webview in section"
      if (pane?.app && pTab) {
        section.querySelector(".empty-state")?.remove();
        let wv = frame.querySelector(`webview[data-tab-id="${pTab.id}"]`);
        if (!wv) {
          wv = document.createElement("webview");
          wv.setAttribute("src", pTab.url);
          wv.setAttribute("partition", partition(pane.app.id, pane.app.partitionKey, pTab));
          wv.setAttribute("data-tab-id", pTab.id);
          wv.setAttribute("data-app-id", pane.app.id);
          wv.setAttribute("allowpopups", "");
          wv.setAttribute("useragent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

        }
        wv.className = `active pane-${side}`;
        wv.dataset.muted = pTab.muted ? "true" : "false";
        if (wv.parentElement !== section) section.appendChild(wv);
        // Evict stale webviews that don't belong to this pane
        section.querySelectorAll("webview").forEach(w => { if (w !== wv) frame.appendChild(w); });
      } else {
        section.querySelectorAll("webview").forEach(wv => frame.appendChild(wv));
        if (!section.querySelector(".empty-state")) {
          const es = document.createElement("div");
          es.className = "empty-state";
          es.textContent = "Dépose une app ici";
          section.appendChild(es);
        }
      }
    }
    // Drop orphaned webviews not belonging to either pane
    frame.querySelectorAll(":scope > webview").forEach(wv => {
      if (wv.dataset.tabId !== lTabId && wv.dataset.tabId !== rTabId) wv.remove();
    });
  } else {
    // Move webviews from split sections back into frame before removing sections
    frame.querySelectorAll(".split-pane").forEach(s => {
      s.querySelectorAll("webview").forEach(wv => frame.appendChild(wv));
      s.remove();
    });
    frame.querySelector(".empty-state")?.remove();

    if (app) {
      const allTabs = tabsFor(app.id).filter(t => !S.secretsHidden || !t.secret);
      const neededIds = new Set(allTabs.map(t => t.id));
      frame.querySelectorAll("webview").forEach(wv => { if (!neededIds.has(wv.dataset.tabId)) wv.remove(); });
      if (allTabs.length) {
        allTabs.forEach(t => {
          let wv = frame.querySelector(`webview[data-tab-id="${t.id}"]`);
          if (!wv) {
            wv = document.createElement("webview");
            wv.setAttribute("src", t.url);
            wv.setAttribute("partition", partition(app.id, app.partitionKey, t));
            wv.setAttribute("data-tab-id", t.id);
            wv.setAttribute("data-app-id", app.id);
            wv.setAttribute("allowpopups", "");
            wv.setAttribute("useragent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
            frame.appendChild(wv);
          }
          wv.className = t.id === ui.activeTabId ? "active pane-left" : "";
          wv.dataset.muted = t.muted ? "true" : "false";
        });
      } else {
        const box = document.createElement("div");
        box.className = "empty-state";
        box.innerHTML = `<div class="empty-box"><h1>${S.secretsHidden?"Onglets secrets cachés":"Ajoute une app"}</h1><p>${S.secretsHidden?"Cmd/Ctrl+Shift+H les réaffiche.":"CrokETT organise les apps web par workspace."}</p></div>`;
        frame.appendChild(box);
      }
    } else {
      frame.querySelectorAll("webview").forEach(wv => wv.remove());
      const box = document.createElement("div");
      box.className = "empty-state";
      box.innerHTML = `<div class="empty-box"><h1>${S.secretsHidden?"Onglets secrets cachés":"Ajoute une app"}</h1><p>${S.secretsHidden?"Cmd/Ctrl+Shift+H les réaffiche.":"CrokETT organise les apps web par workspace."}</p><button class="primary" data-open-add>Ajouter</button></div>`;
      frame.appendChild(box);
    }
  }
}

function renderSplitPane(side, pane, tab) {
  const apps = visibleWorkspaceApps();
  const selId = pane?.app?.id || "";
  return `
    <section class="split-pane" data-split-pane="${side}">
      <div class="split-pane-toolbar">
        <select data-split-select="${side}">
          ${apps.map(i => `<option value="${esc(i.app.id)}"${i.app.id===selId?" selected":""}>${esc(i.app.name)}</option>`).join("")}
        </select>
        <form data-split-url="${side}">
          <input name="url" value="${esc(tab?.url||"")}" autocomplete="off" spellcheck="false" />
        </form>
      </div>
      ${pane?.app && tab
        ? `<webview class="active pane-${side}" src="${esc(tab.url)}" partition="${esc(partition(pane.app.id,pane.app.partitionKey,tab))}" data-tab-id="${esc(tab.id)}" data-app-id="${esc(pane.app.id)}" data-muted="${tab.muted?"true":"false"}" allowpopups></webview>`
        : `<div class="empty-state">Dépose une app ici</div>`}
    </section>`;
}

function renderContextMenu(menu) {
  if (menu?.kind !== "app") return "";
  const app = findApp(menu.appId); if (!app) return "";
  return `<div class="context-menu" style="left:${menu.x}px;top:${menu.y}px">
    <button data-ctx="open"><span>○</span> Ouvrir</button>
    <button data-ctx="new-tab"><span>+</span> Nouvel onglet</button>
    <button data-ctx="secret-tab"><span>◈</span> Onglet secret</button>
    <hr/>
    <button data-ctx="split-left"><span>◧</span> Split gauche</button>
    <button data-ctx="split-right"><span>◨</span> Split droite</button>
    <hr/>
    <button data-ctx="properties"><span>⚙</span> Propriétés</button>
    <button data-ctx="duplicate"><span>⧉</span> Dupliquer</button>
    <button data-ctx="notifications"><span>▵</span> ${app.notifications?"Muet":"Notifs"}</button>
    <button data-ctx="hidden"><span>ø</span> ${app.hidden?"Afficher":"Cacher"}</button>
    <hr/>
    <button data-ctx="delete" class="danger-text" style="color:var(--accent-warning)"><span>✕</span> Supprimer</button>
  </div>`;
}

function renderTabMenu(menu) {
  if (menu?.kind !== "tab") return "";
  const tab = findTabById(menu.tabId); if (!tab) return "";
  const app = activeApp();
  return `<div class="context-menu tab-menu" style="left:${menu.x}px;top:${menu.y}px">
    <button data-tab-act="new-tab"><span>+</span> Nouvel onglet</button>
    <hr/>
    <button data-tab-act="close"><span>✕</span> Fermer</button>
    <button data-tab-act="close-others"><span>×</span> Autres</button>
    <hr/>
    <button data-tab-act="mute"><span>◉</span> ${tab.muted?"Sourdine off":"Muet"}</button>
    <button data-tab-act="pin"><span>▲</span> ${tab.pinned?"Détacher":"Épingler"}</button>
    <hr/>
    <button data-tab-act="open-browser"><span>↗</span> Navigateur</button>
  </div>`;
}

function renderWorkspaceMenu(menu) {
  if (menu?.kind !== "workspace") return "";
  return `<div class="context-menu" style="left:${menu.x}px;top:${menu.y}px">
    <button data-ws-act="properties"><span>⚙</span> Propriétés</button>
    <button data-ws-act="previous"><span>↑</span> Précédent</button>
    <button data-ws-act="next"><span>↓</span> Suivant</button>
  </div>`;
}

function renderPageMenu(menu) {
  if (menu?.kind !== "page") return "";
  const tab = activeTab();
  return `<div class="context-menu page-menu" style="left:${menu.x}px;top:${menu.y}px">
    <div class="context-label">Page</div>
    <button data-page-act="reload"><span>↻</span> Recharger</button>
    <button data-page-act="share"><span>⇪</span> Partager</button>
    <button data-page-act="secret"><span>◈</span> ${tab?.secret?"Public":"Secret"}</button>
    <hr/>
    <button data-page-act="mask-url"><span>ø</span> ${S.maskUrl?"URL on":"URL off"}</button>
    <button data-page-act="external"><span>↗</span> Navigateur</button>
  </div>`;
}

function renderAppBarMenu(menu) {
  if (menu?.kind !== "appbar") return "";
  return `<div class="context-menu appbar-menu" style="left:${menu.x}px;top:${menu.y}px">
    <div class="context-label">Actions</div>
    <button data-page-act="properties"><span>⚙</span> Propriétés</button>
    <button data-page-act="share"><span>⇪</span> Partager</button>
    <button data-page-act="duplicate"><span>⧉</span> Dupliquer</button>
    <hr/>
    <button data-page-act="delete" class="danger-text" style="color:var(--accent-warning)"><span>✕</span> Supprimer</button>
  </div>`;
}


function renderAddModal() {
  return `<div class="modal-backdrop" id="add-modal">
    <form class="modal" data-add-form>
      <h2>Ajouter une application</h2>
      <div class="field"><label>Nom</label><input name="name" placeholder="Ex: Perplexity" required autofocus /></div>
      <div class="field"><label>URL</label><input name="url" placeholder="https://..." required /></div>
      <div class="modal-actions">
        <button type="button" class="secondary" data-close-add>Annuler</button>
        <button type="submit" class="primary">Ajouter</button>
      </div>
    </form>
  </div>`;
}

function renderPropertiesModal() {
  const app = ui.propertiesAppId ? findApp(ui.propertiesAppId) : null;
  if (!app) return "";
  const icon = app.iconImage || favicon(app.url);
  const colorItem = (c) => `<label class="color-swatch-label" style="background:${esc(c)}"><input type="radio" name="backgroundColor" value="${esc(c)}" ${app.backgroundColor===c?"checked":""}></label>`;

  return `<div class="modal-backdrop open" id="properties-modal">
    <form class="modal" data-props-form data-app-id="${esc(app.id)}">
      <div class="property-head">
        <span class="app-icon large" style="background:${esc(app.color)}">${icon?`<img src="${esc(icon)}" alt="" />`:`${esc(initials(app.name))}`}</span>
        <div><strong>${esc(app.name)}</strong><small>${esc(hostname(app.url))}</small></div>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="field"><label>Nom</label><input name="name" value="${esc(app.name)}" required /></div>
        <div class="field"><label>URL</label><input name="url" value="${esc(app.url)}" required /></div>
      </div>

      <div class="field"><label>Couleur de fond (Fluo & Pastel)</label>
        <div style="display:grid; grid-template-columns:repeat(10, 1fr); gap:6px; margin-bottom:6px">
          ${colorFluo.map(colorItem).join("")}
        </div>
        <div style="display:grid; grid-template-columns:repeat(10, 1fr); gap:6px; align-items:center">
          ${colorPale.map(colorItem).join("")}
          <label class="color-swatch-label transparent-swatch"><input type="radio" name="backgroundColor" value="transparent" ${app.backgroundColor==="transparent"||!app.backgroundColor?"checked":""}>✕</label>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="field"><label>Couleur icône</label><input name="color" type="color" value="${esc(app.color)}" style="height:34px; padding:2px" /></div>
        <div class="field"><label>Priorité</label><input name="priority" type="number" value="${Number(app.priority||0)}" /></div>
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:12px;">
        <label class="check-row"><input type="checkbox" name="notifications"${app.notifications?" checked":""}> Notifs</label>
        <label class="check-row"><input type="checkbox" name="secret"${app.secret?" checked":""}> Secret</label>
        <label class="check-row"><input type="checkbox" name="hidden"${app.hidden?" checked":""}> Caché</label>
      </div>

      <div class="modal-actions split">
        <button type="button" class="danger" data-delete-app="${esc(app.id)}">Supprimer</button>
        <div style="display:flex; gap:10px;">
          <button type="button" class="secondary" data-close-props>Annuler</button>
          <button type="submit" class="primary">Enregistrer</button>
        </div>
      </div>
    </form>
  </div>`;
}

function renderWorkspaceModal() {
  const ws = ui.propertiesWorkspaceId ? findWorkspace(ui.propertiesWorkspaceId) : null;
  if (!ws) return "";
  const colorItem = (c) => `<label class="color-swatch-label" style="background:${esc(c)}"><input type="radio" name="backgroundColor" value="${esc(c)}" ${ws.backgroundColor===c?"checked":""}></label>`;

  return `<div class="modal-backdrop open" id="workspace-modal">
    <form class="modal" data-ws-form data-ws-id="${esc(ws.id)}">
      <h2>Propriétés du groupe</h2>
      
      <div class="field"><label>Nom du groupe</label><input name="name" value="${esc(ws.name)}" required /></div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="field"><label>Icône texte</label><input name="icon" value="${esc(ws.icon)}" maxlength="2" required /></div>
        <div class="field"><label>Priorité</label><input name="priority" type="number" value="${Number(ws.priority||0)}" /></div>
      </div>

      <div class="field"><label>Couleur de fond (Fluo & Pastel)</label>
        <div style="display:grid; grid-template-columns:repeat(10, 1fr); gap:6px; margin-bottom:6px">
          ${colorFluo.map(colorItem).join("")}
        </div>
        <div style="display:grid; grid-template-columns:repeat(10, 1fr); gap:6px; align-items:center">
          ${colorPale.map(colorItem).join("")}
          <label class="color-swatch-label transparent-swatch"><input type="radio" name="backgroundColor" value="transparent" ${ws.backgroundColor==="transparent"||!ws.backgroundColor?"checked":""}>✕</label>
        </div>
      </div>

      <div class="field"><label>Couleur icône</label><input name="color" type="color" value="${esc(ws.color)}" style="height:34px; padding:2px" /></div>
      
      <label class="check-row"><input type="checkbox" name="collapsed"${ws.collapsed?" checked":""}> Replié par défaut</label>

      <div class="modal-actions">
        <button type="button" class="secondary" data-close-ws-modal>Annuler</button>
        <button type="submit" class="primary">Enregistrer les modifications</button>
      </div>
    </form>
  </div>`;
}

function renderShareModal() {
  if (!ui.shareDraft) return "";
  return `<div class="modal-backdrop open" id="share-modal">
    <div class="modal">
      <h2>Partager la page</h2>
      <div class="share-preview">${esc(shareText())}</div>
      <div class="share-actions">
        <button class="secondary" data-share-to="copy">Copier</button>
        <button class="secondary" data-share-to="x">X / Twitter</button>
        <button class="secondary" data-share-to="linkedin">LinkedIn</button>
      </div>
      <div class="modal-actions"><button class="primary" style="width:100%" data-close-share>Terminer</button></div>
    </div>
  </div>`;
}

function renderSettings() {
  if (!S.settingsOpen) return "";
  const sections = [["general","⌘","Général"],["downloads","⇩","Téléchargements"],["notifications","♢","Notifications"],["shortcuts","⌨","Raccourcis"],["permissions","◇","Micro/caméra"],["fonts","T","Polices"],["sync","↻","Sync"],["extensions","✜","Extensions"],["import","⇳","Importer/Exporter"],["advanced","⌁","Avancé"]];
  return `<div class="settings-panel">
    <aside class="settings-nav">
      <h2>Paramètres</h2>
      ${sections.map(([id,ico,label])=>`<button class="${S.settingsSection===id?"active":""}" data-settings-nav="${id}"><span>${ico}</span>${label}</button>`).join("")}
    </aside>
    <section class="settings-body">
      <button class="settings-close" data-close-settings>×</button>
      ${renderSettingsBody()}
    </section>
  </div>`;
}

function renderSettingsBody() {
  const sw = (key) => `<button class="switch${S[key]?" on":""}" data-toggle="${esc(key)}"><span></span></button>`;
  
  if (S.settingsSection === "general") return `
    <div class="settings-card">
      <h3>Affichage & Interface</h3>
      <p>Personnalisez le comportement visuel de votre environnement.</p>
      <div class="settings-control-group">
        <div class="settings-row"><div><strong>Masquer l'URL</strong><br><small>Affiche seulement le domaine pour plus de clarté.</small></div>${sw("maskUrl")}</div>
        <div class="settings-row"><div><strong>Colonne compacte</strong><br><small>Icônes seules dans la barre latérale.</small></div>${sw("sidebarCollapsed")}</div>
        <div class="settings-row"><div><strong>Mode interface</strong></div>
          <select data-density="${S.density}">
            <option value="compact"${S.density==="compact"?" selected":""}>Compact</option>
            <option value="normal"${S.density==="normal"?" selected":""}>Normal</option>
            <option value="large"${S.density==="large"?" selected":""}>Large</option>
          </select>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <h3>Visibilité</h3>
      <div class="settings-control-group">
        <div class="settings-row"><div><strong>Apps cachées</strong><br><small>Afficher temporairement les applications masquées.</small></div>${sw("showHiddenApps")}</div>
        <div class="settings-row"><div><strong>Masquer apps filtrées</strong><br><small>Cacher les apps marquées comme "cachables".</small></div>${sw("hideCachableApps")}</div>
      </div>
    </div>`;

  if (S.settingsSection === "extensions") return `
    <div class="settings-card">
      <h3>Extensions & Sécurité</h3>
      <div class="settings-control-group">
        <div class="settings-row"><div><strong>Bloqueur de publicités</strong><br><small>Filtre natif des publicités courantes.</small></div>${sw("adBlockEnabled")}</div>
      </div>
    </div>
    <div class="settings-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3>Extensions Chrome</h3>
        <button class="primary" data-add-ext>+ Ajouter</button>
      </div>
      <div class="extension-list">${S.chromeExtensions.length?S.chromeExtensions.map(renderExtRow).join(""):`<div class="empty-settings">Aucune extension chargée.</div>`}</div>
    </div>`;

  if (S.settingsSection === "notifications") return `
    <div class="settings-card">
      <h3>Notifications</h3>
      <div class="settings-control-group">
        <div class="settings-row"><div><strong>Notifications globales</strong></div>${sw("globalNotifications")}</div>
        <div class="settings-row"><div><strong>Badges sur les apps</strong></div>${sw("notificationBadges")}</div>
        <div class="settings-row"><div><strong>Signal sonore</strong></div>${sw("notificationSound")}</div>
      </div>
    </div>`;

  if (S.settingsSection === "downloads") return `
    <div class="settings-card">
      <h3>Téléchargements</h3>
      <div class="settings-control-group">
        <div class="settings-row"><div><strong>Demander l'emplacement</strong></div>${sw("askDownloadLocation")}</div>
        <div class="settings-row" style="flex-direction:column; align-items:flex-start; gap:8px;">
          <strong>Dossier par défaut</strong>
          <input type="text" style="width:100%" data-text-setting="downloadsPath" value="${esc(S.downloadsPath)}" placeholder="~/Downloads" />
        </div>
      </div>
    </div>`;

  if (S.settingsSection === "fonts") return `
    <div class="settings-card">
      <h3>Typographie</h3>
      <div class="settings-control-group">
        <div class="settings-row">
          <strong>Police de l'interface</strong>
          <select data-font-family>
            ${[["system","Système"],["sans","Sans-serif"],["serif","Serif"],["mono","Monospace"]].map(([v,l])=>`<option value="${v}"${S.uiFont===v?" selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="settings-row" style="flex-direction:column; align-items:flex-start; gap:8px;">
          <div style="display:flex; justify-content:space-between; width:100%"><strong>Taille du texte</strong><span>${S.fontScale}%</span></div>
          <input type="range" style="width:100%" min="80" max="130" step="5" value="${S.fontScale}" data-range-setting="fontScale" />
        </div>
      </div>
    </div>`;

  if (S.settingsSection === "import") return `
    <div class="settings-card">
      <h3>Sauvegarde & Import</h3>
      <p>Exportez votre configuration pour la synchroniser sur un autre poste.</p>
      <div class="settings-control-group">
        <div class="settings-row">
          <button class="primary" data-export>Exporter la configuration</button>
          <button class="secondary" data-import>Importer un fichier JSON</button>
          <input type="file" id="import-file" accept="application/json" hidden />
        </div>
      </div>
    </div>`;

  return `<div class="settings-card"><h3>Paramètres</h3><p>Section en cours de maintenance.</p></div>`;
}

function renderExtRow(e) {
  const s={loaded:"chargée",pending:"en attente",disabled:"désactivée",error:"erreur"}[e.status]||e.status;
  return `<div class="extension-row">
    <div class="extension-main"><strong>${esc(e.name||"Extension")}</strong><small>${esc(e.path)}</small>${e.error?`<em>${esc(e.error)}</em>`:""}</div>
    <span class="extension-status ${esc(e.status)}">${esc(s)}</span>
    <button class="switch${e.enabled?" on":""}" data-toggle-ext="${esc(e.id)}"><span></span></button>
    <button class="secondary" data-remove-ext="${esc(e.id)}">Retirer</button>
  </div>`;
}

// ── WEBVIEW WIRING ────────────────────────────────────────────────────────────
// Only webviews need post-render wiring — their events don't bubble through the DOM.

let chromeExtRestored = false;

function wireWebviews() {
  document.querySelectorAll("webview").forEach(wv => {
    if (wv.__wired) return;
    wv.__wired = true;

    wv.addEventListener("did-start-loading", () => { if (wv.classList.contains("active")) root.querySelector(".browser")?.classList.add("loading"); });
    wv.addEventListener("did-stop-loading",  () => { if (wv.classList.contains("active")) root.querySelector(".browser")?.classList.remove("loading"); });
    wv.addEventListener("did-navigate", () => syncWv(wv));
    wv.addEventListener("did-navigate-in-page", () => syncWv(wv));
    wv.addEventListener("page-title-updated", e => updateWvTitle(wv, e.title));
    wv.addEventListener("did-finish-load", () => { hookNotifications(wv); applyAdBlock(wv); applyMute(wv); injectWebviewFont(wv); });
    wv.addEventListener("console-message", e => {
      if (String(e.message||"").startsWith("__CROKETTS_NOTIFICATION__"))
        incrementNotification(wv.dataset.appId);
    });
    wv.addEventListener("new-window", e => { e.preventDefault(); window.crokETT?.openExternal?.(e.url); });

    // Clic droit dans le webview — event Electron, ne remonte pas au document
    wv.addEventListener("context-menu", e => {
      // e.params.x/y = coords dans le referentiel du webview (CSS px)
      // Fallback sur e.x/e.y si params absent (certaines versions Electron)
      const px = e.params?.x ?? e.x ?? null;
      const py = e.params?.y ?? e.y ?? null;
      const rect = wv.getBoundingClientRect();
      const menuX = px !== null ? rect.left + px : e.clientX ?? rect.left + rect.width / 2;
      const menuY = py !== null ? rect.top  + py : e.clientY ?? rect.top  + rect.height / 2;
      // Stocker la ref du webview pour que les actions ciblent le bon pane (split)
      ui.menu = {
        kind: "page",
        x: Math.min(menuX, window.innerWidth  - 220),
        y: Math.min(menuY, window.innerHeight - 420),
        wv
      };
      render();
    });
  });

  if (!chromeExtRestored) {
    chromeExtRestored = true;
    (async () => {
      for (const e of S.chromeExtensions.filter(e => e.enabled)) {
        try { Object.assign(e, await window.crokETT.loadChromeExtension(e.path)); }
        catch(err) { e.status = "error"; e.error = err?.message || String(err); }
      }
      save();
    })();
  }
}

function syncWv(wv) {
  const url = wv.getURL?.() || ""; if (!url) return;
  const tab = findTabById(wv.dataset.tabId); if (!tab) return;
  if (tab.url !== url) { tab.url = url; }
  const input = document.querySelector(".address-form input");
  if (input && wv.classList.contains("active")) {
    const app = activeApp();
    input.value = (S.maskUrl || app?.maskUrl) ? hostname(url) : url;
  }
}
function updateWvTitle(wv, title) {
  const tab = findTabById(wv.dataset.tabId); if (!tab || tab.pinned) return;
  const clean = String(title||"").replace(/^\(\d+\)\s*/,"");
  if (tab.title !== clean) {
    tab.title = clean;
    save();
    // Surgical update instead of full render
    const tabEl = document.querySelector(`[data-tab="${esc(tab.id)}"] .tab-title`);
    if (tabEl) tabEl.textContent = clean;
  }
}
function applyMute(wv) {
  if (typeof wv.setAudioMuted === "function") wv.setAudioMuted(wv.dataset.muted === "true");
}

// ── EVENT DELEGATION ──────────────────────────────────────────────────────────
// One listener per event type, all routing done by data attributes.

document.addEventListener("click", onClick);
document.addEventListener("contextmenu", onContextMenu, true); // capture = avant que webview intercepte
document.addEventListener("pointerdown", onPointerDown);       // fallback clic droit
document.addEventListener("change", onChange);
document.addEventListener("submit", onSubmit);
document.addEventListener("input", onInput);
document.addEventListener("keydown", onKeyDown);
document.addEventListener("dragstart", onDragStart);
document.addEventListener("dragover", onDragOver);
document.addEventListener("drop", onDrop);

function onClick(e) {
  const t = e.target;

  // Quick Switcher delegation
  if (t.closest("[data-close-switcher]")) { ui.quickSwitcherOpen = false; render(); return; }
  const switcherSelect = t.closest("[data-switcher-select]");
  if (switcherSelect) {
    const res = ui.quickSwitcherResults[Number(switcherSelect.dataset.switcherSelect)];
    if (res) {
      ui.quickSwitcherOpen = false;
      if (res.kind === "workspace") selectWorkspace(res.id);
      if (res.kind === "app") selectApp(res.id, res.workspaceId);
    }
    return;
  }
  if (t.closest(".quick-switcher")) return;

  // ── Tab inner buttons (closest finds deepest match first) ────────────────
  const closeTab = t.closest("[data-close-tab]");
  if (closeTab) { doCloseTab(closeTab.dataset.closeTab); return; }

  const tabMenuBtn = t.closest("[data-tab-menu]");
  if (tabMenuBtn) {
    const tabId = tabMenuBtn.dataset.tabMenu;
    const rect = tabMenuBtn.getBoundingClientRect();
    ui.activeTabId = tabId;
    ui.menu = { kind:"tab", tabId, x: Math.min(rect.left, window.innerWidth - 440), y: rect.bottom + 6 };
    render(); return;
  }

  const tabBtn = t.closest("[data-tab]");
  if (tabBtn) { selectTab(tabBtn.dataset.tab); return; }

  // ── Toast dismiss ────────────────────────────────────────────────────────
  if (t.closest("[data-close-toast]")) { ui.toast = null; render(); return; }

  // ── Context menus ────────────────────────────────────────────────────────
  if (t.closest(".context-menu")) {
    // actions handled below; if no action found, keep menu open
  } else if (ui.menu) {
    ui.menu = null; render(); return;
  }

  // ── Tab menu actions ─────────────────────────────────────────────────────
  const tabAct = t.closest("[data-tab-act]");
  if (tabAct && ui.menu?.kind === "tab") {
    const act = tabAct.dataset.tabAct;
    const tab = findTabById(ui.menu.tabId);
    const app = activeApp();
    ui.menu = null;
    if (act === "new-tab")      createTab(tab?.url);
    if (act === "close")        doCloseTab(tab?.id);
    if (act === "close-others") closeOtherTabs(tab?.id);
    if (act === "close-right")  closeTabsToRight(tab?.id);
    if (act === "open-browser") window.crokETT?.openExternal?.(tab?.url);
    if (act === "open-window")  window.crokETT?.openNewWindow?.(tab?.url);
    if (act === "split-right")  { S.splitOrientation="horizontal"; if (app) splitAppToPane(app.id,"right"); else render(); }
    if (act === "split-bottom") { S.splitOrientation="vertical";   if (app) splitAppToPane(app.id,"right"); else render(); }
    if (act === "mute")         toggleTabMuted(tab?.id);
    if (act === "pin")          toggleTabPinned(tab?.id);
    if (act === "rename")       renamePinnedTab(tab?.id);
    if (act === "open-app")     createTabInApp(tabAct.dataset.appId, tab?.url);
    return;
  }

  // ── App context menu actions ─────────────────────────────────────────────
  const ctxAct = t.closest("[data-ctx]");
  if (ctxAct && ui.menu?.kind === "app") {
    const act = ctxAct.dataset.ctx;
    const appId = ui.menu.appId;
    ui.menu = null;
    if (act === "open")           selectApp(appId);
    if (act === "new-tab")        { selectApp(appId); createTab(); }
    if (act === "secret-tab")     { selectApp(appId); createTab(null, true); }
    if (act === "split-left")     splitAppToPane(appId, "left");
    if (act === "split-right")    splitAppToPane(appId, "right");
    if (act === "properties")     { ui.propertiesAppId = appId; render(); }
    if (act === "duplicate")      duplicateApp(appId);
    if (act === "notifications")  { const a=findApp(appId); if(a){a.notifications=!a.notifications;commit();} }
    if (act === "hidden")         toggleAppHidden(appId);
    if (act === "clear-count")    { const a=findApp(appId); if(a){a.notificationCount=0;commit();} }
    if (act === "delete")         deleteApp(appId);
    return;
  }

  // ── Workspace menu actions ───────────────────────────────────────────────
  const wsAct = t.closest("[data-ws-act]");
  if (wsAct && ui.menu?.kind === "workspace") {
    const act = wsAct.dataset.wsAct;
    const wid = ui.menu.workspaceId;
    ui.menu = null;
    if (act === "properties") { ui.propertiesWorkspaceId = wid; render(); }
    if (act === "previous")   { const i=S.workspaces.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(S.workspaces[(i-1+S.workspaces.length)%S.workspaces.length].id); }
    if (act === "next")       { const i=S.workspaces.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(S.workspaces[(i+1)%S.workspaces.length].id); }
    return;
  }

  // ── Page menu actions ────────────────────────────────────────────────────
  const pageAct = t.closest("[data-page-act]");
  if (pageAct) {
    const act = pageAct.dataset.pageAct;
    // En split, cibler le webview qui a déclenché le menu (stocké dans ui.menu.wv)
    const wv = ui.menu?.wv || document.querySelector("webview.active");
    const app = activeApp();
    ui.menu = null;
    if (act === "back")         wv?.goBack?.();
    if (act === "forward")      wv?.goForward?.();
    if (act === "reload")       wv?.reload?.();
    if (act === "share")        openShare();
    if (act === "secret")       toggleActiveTabSecret();
    if (act === "hide-secrets") toggleSecretsHidden();
    if (act === "mask-url")     { S.maskUrl = !S.maskUrl; commit(); }
    if (act === "external")     window.crokETT?.openExternal?.(activeTab()?.url);
    if (act === "properties")   { ui.propertiesAppId = app?.id; render(); }
    if (act === "duplicate")    app && duplicateApp(app.id);
    if (act === "notifications"){ if(app){app.notifications=!app.notifications;commit();} }
    if (act === "hidden")       app && toggleAppHidden(app.id);
    if (act === "clear-count")  { if(app){app.notificationCount=0;commit();} }
    if (act === "delete")       app && deleteApp(app.id);
    if (act === "ws-properties"){ ui.propertiesWorkspaceId = activeWorkspace()?.id; render(); }
    if (act === "ws-previous")  { const ws=S.workspaces; const i=ws.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(ws[(i-1+ws.length)%ws.length].id); }
    if (act === "ws-next")      { const ws=S.workspaces; const i=ws.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(ws[(i+1)%ws.length].id); }
    if (!["share","secret","hide-secrets","mask-url","external","properties","duplicate","notifications","hidden","clear-count","delete","ws-properties","ws-previous","ws-next"].includes(act)) render();
    return;
  }

  // ── Nav buttons ──────────────────────────────────────────────────────────
  const navBtn = t.closest("[data-nav]");
  if (navBtn) {
    const wv = document.querySelector("webview.active");
    if (navBtn.dataset.nav === "back")    wv?.goBack?.();
    if (navBtn.dataset.nav === "forward") wv?.goForward?.();
    if (navBtn.dataset.nav === "reload")  wv?.reload?.();
    return;
  }

  // ── Toolbar buttons ──────────────────────────────────────────────────────
  if (t.closest("[data-new-tab]"))    { createTab(); return; }
  if (t.closest("[data-share]"))      { openShare(); return; }
  if (t.closest("[data-split-toggle]")){ toggleSplitView(); return; }
  if (t.closest("[data-external]")) {
    window.crokETT?.openExternal?.(activeTab()?.url); return;
  }
  if (t.closest("[data-page-menu-btn]")) {
    if (ui.menu?.kind === "page") { ui.menu = null; render(); return; }
    const btn = t.closest("[data-page-menu-btn]");
    const rect = btn.getBoundingClientRect();
    ui.menu = { kind:"page", x: Math.max(8, Math.min(rect.left - 180, window.innerWidth - 300)), y: rect.bottom + 8 };
    render(); return;
  }
  if (t.closest("[data-appbar-menu-btn]")) {
    if (ui.menu?.kind === "appbar") { ui.menu = null; render(); return; }
    const btn = t.closest("[data-appbar-menu-btn]");
    const rect = btn.getBoundingClientRect();
    ui.menu = { kind:"appbar", x: Math.max(8, Math.min(rect.left - 160, window.innerWidth - 280)), y: rect.bottom + 8 };
    render(); return;
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const wsBtn = t.closest("[data-ws]");
  if (wsBtn) {
    const wid = wsBtn.dataset.ws;
    if (wid === S.activeWorkspaceId) {
      toggleWorkspaceCollapsed(wid);
    } else {
      selectWorkspace(wid);
    }
    return;
  }
  const toggleWs = t.closest("[data-toggle-ws]");
  if (toggleWs) { toggleWorkspaceCollapsed(toggleWs.dataset.toggleWs); return; }
  const appBtn = t.closest("[data-ws-app]");
  if (appBtn) {
    const [wid, aid] = appBtn.dataset.wsApp.split(":");
    selectApp(aid, wid); return;
  }

  const groupMenuBtn = t.closest("[data-group-menu-btn]");
  if (groupMenuBtn) {
    const wid = groupMenuBtn.dataset.groupMenuBtn;
    ui.groupMenuOpen = ui.groupMenuOpen === wid ? null : wid;
    render(); return;
  }

  const bgColorBtn = t.closest("[data-bg-color]");
  if (bgColorBtn) {
    const [wid, color] = bgColorBtn.dataset.bgColor.split(":");
    const ws = findWorkspace(wid);
    if (ws) {
      ws.backgroundColor = color;
      ui.groupMenuOpen = null;
      commit();
    }
    return;
  }

  if (t.closest("[data-add-ws]"))      { addWorkspace(); return; }
  if (t.closest("[data-toggle-cachable]")) { S.hideCachableApps=!S.hideCachableApps; commit(); return; }
  if (t.closest("[data-open-add]"))    { document.getElementById("add-modal")?.classList.add("open"); return; }

  // ── Modals ────────────────────────────────────────────────────────────────
  if (t.closest("[data-close-add]"))   { document.getElementById("add-modal")?.classList.remove("open"); return; }
  if (t.closest("[data-close-props]")) { ui.propertiesAppId = null; render(); return; }
  if (t.closest("[data-close-ws-modal]")) { ui.propertiesWorkspaceId = null; render(); return; }
  if (t.closest("[data-close-share]")) { ui.shareDraft = null; render(); return; }
  const shareBtn = t.closest("[data-share-to]");
  if (shareBtn) { shareTo(shareBtn.dataset.shareTo); return; }
  const deleteApp_ = t.closest("[data-delete-app]");
  if (deleteApp_) { deleteApp(deleteApp_.dataset.deleteApp); return; }

  // ── Settings ─────────────────────────────────────────────────────────────
  const openSet = t.closest("[data-open-settings]");
  if (openSet) { S.settingsOpen=true; S.settingsSection=openSet.dataset.openSettings||"general"; commit(); return; }
  if (t.closest("[data-close-settings]")) { S.settingsOpen=false; commit(); return; }
  const navSet = t.closest("[data-settings-nav]");
  if (navSet) { S.settingsSection=navSet.dataset.settingsNav; render(); return; }
  const density = t.closest("[data-density]");
  if (density) { S.density=density.dataset.density; commit(); return; }
  const togBtn = t.closest("[data-toggle]");
  if (togBtn) { S[togBtn.dataset.toggle]=!S[togBtn.dataset.toggle]; syncNative(); commit(); return; }
  if (t.closest("[data-export]"))  { exportConfig(); return; }
  if (t.closest("[data-import]"))  { document.getElementById("import-file")?.click(); return; }
  if (t.closest("[data-add-ext]")) { loadChromeExtension(); return; }
  const rmExt = t.closest("[data-remove-ext]");
  if (rmExt) { removeChromeExtension(rmExt.dataset.removeExt); return; }
  const togExt = t.closest("[data-toggle-ext]");
  if (togExt) { const e=S.chromeExtensions.find(e=>e.id===togExt.dataset.toggleExt); if(e) setChromeExtEnabled(e.id,!e.enabled); return; }
}

function onContextMenu(e) {
  // App button right-click
  const appBtn = e.target.closest("[data-ws-app]");
  if (appBtn) {
    e.preventDefault();
    const [wid, aid] = appBtn.dataset.wsApp.split(":");
    S.activeWorkspaceId = wid; S.activeAppByWorkspace[wid] = aid;
    ui.menu = { kind:"app", appId: aid, x: e.clientX, y: e.clientY };
    save(); render(); return;
  }
  // Workspace right-click
  const wsBtn = e.target.closest("[data-ws]");
  if (wsBtn) {
    e.preventDefault();
    ui.menu = { kind:"workspace", workspaceId: wsBtn.dataset.ws, x: e.clientX, y: e.clientY };
    render(); return;
  }
  // Tab right-click
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) {
    e.preventDefault();
    ui.activeTabId = tabBtn.dataset.tab;
    ui.menu = { kind:"tab", tabId: tabBtn.dataset.tab, x: e.clientX, y: e.clientY };
    render(); return;
  }
}

function onChange(e) {
  const t = e.target;
  const splitSel = t.closest("[data-split-select]");
  if (splitSel) { setSplitPaneApp(splitSel.dataset.splitSelect, t.value); return; }
  const perm = t.closest("[data-perm]");
  if (perm) { S[perm.dataset.perm] = normPerm(t.value); syncNative(); commit(); return; }
  const skinSel = t.closest("[data-skin-select]");
  if (skinSel) { S.skin = t.value; commit(); return; }
  const fontFamSel = t.closest("[data-font-family]");
  if (fontFamSel) { S.uiFont = ["system","sans","serif","mono"].includes(t.value) ? t.value : "system"; commit(); return; }
  if (t.id === "import-file") { importConfig(t.files?.[0]); return; }
}

function onSubmit(e) {
  e.preventDefault();
  const t = e.target;
  if (t.closest("[data-add-form]"))  { addCustomApp(Object.fromEntries(new FormData(t))); document.getElementById("add-modal")?.classList.remove("open"); return; }
  if (t.closest("[data-props-form]")){ updateAppProperties(t.dataset.appId, new FormData(t)); return; }
  if (t.closest("[data-ws-form]"))   { updateWorkspaceProperties(t.dataset.wsId, new FormData(t)); return; }
  if (t.closest("[data-url-form]"))  { updateActiveTabUrl(new FormData(t).get("url")); return; }
  const splitUrl = t.closest("[data-split-url]");
  if (splitUrl) { updateSplitPaneUrl(splitUrl.dataset.splitUrl, new FormData(t).get("url")); return; }
  const skinForm = t.closest("[data-skin-form]");
  if (skinForm) {
    const fd = new FormData(t);
    S.skin = "custom";
    S.customSkin = { cream: String(fd.get("cream")||S.customSkin.cream), sidebar: String(fd.get("sidebar")||S.customSkin.sidebar), accent: String(fd.get("accent")||S.customSkin.accent) };
    commit(); return;
  }
}

function onInput(e) {
  const t = e.target;

  if (t.matches("[data-switcher-input]")) {
    ui.quickSwitcherQuery = t.value;
    updateQuickSwitcherResults();
    render();
    return;
  }

  const iconSize = t.closest("[data-icon-size]");
  if (iconSize) {
    const kind = iconSize.dataset.iconSize;
    if (kind === "group") S.groupIconSize = clamp(t.value, 14, 72, 22);
    if (kind === "app")   S.appIconSize   = clamp(t.value, 12, 58, 17);
    save(); applyChrome(); return;
  }
  const rangeSet = t.closest("[data-range-setting]");
  if (rangeSet) { S[rangeSet.dataset.rangeSetting] = clamp(t.value, 80, 130, 100); save(); applyChrome(); return; }
  const textSet = t.closest("[data-text-setting]");
  if (textSet) { S[textSet.dataset.textSetting] = t.value; return; }
}

function onKeyDown(e) {
  const mod = e.metaKey || e.ctrlKey;

  // Quick Switcher Shortcuts
  if (ui.quickSwitcherOpen) {
    if (e.key === "Escape") { ui.quickSwitcherOpen = false; render(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); ui.quickSwitcherIndex = (ui.quickSwitcherIndex + 1) % ui.quickSwitcherResults.length; render(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); ui.quickSwitcherIndex = (ui.quickSwitcherIndex - 1 + ui.quickSwitcherResults.length) % ui.quickSwitcherResults.length; render(); return; }
    if (e.key === "Enter") {
      const res = ui.quickSwitcherResults[ui.quickSwitcherIndex];
      if (res) {
        ui.quickSwitcherOpen = false;
        if (res.kind === "workspace") selectWorkspace(res.id);
        if (res.kind === "app") selectApp(res.id, res.workspaceId);
      }
      return;
    }
  }

  if (mod && e.key === "k") {
    e.preventDefault();
    ui.quickSwitcherOpen = true;
    ui.quickSwitcherQuery = "";
    ui.quickSwitcherIndex = 0;
    updateQuickSwitcherResults();
    render();
    setTimeout(() => document.querySelector("[data-switcher-input]")?.focus(), 10);
    return;
  }

  if (!S.shortcutsEnabled) return;
  if (mod) {
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && S.workspaces[n-1]) { e.preventDefault(); selectWorkspace(S.workspaces[n-1].id); return; }
    if (e.key === "ArrowLeft"  && e.altKey) { e.preventDefault(); const i=S.workspaces.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(S.workspaces[(i-1+S.workspaces.length)%S.workspaces.length].id); return; }
    if (e.key === "ArrowRight" && e.altKey) { e.preventDefault(); const i=S.workspaces.findIndex(w=>w.id===S.activeWorkspaceId); selectWorkspace(S.workspaces[(i+1)%S.workspaces.length].id); return; }
    if (e.shiftKey && e.key === "H")        { toggleSecretsHidden(); return; }
    if (e.key === "t")                      { e.preventDefault(); createTab(); return; }
    if (e.key === "w")                      { e.preventDefault(); const t=activeTab(); if(t) doCloseTab(t.id); return; }
  }
}

function onPointerDown(e) {
  if (e.button !== 2) return; // bouton droit uniquement
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn && !e.target.closest("[data-tab-menu],[data-close-tab]")) {
    ui.activeTabId = tabBtn.dataset.tab;
    ui.menu = { kind:"tab", tabId: tabBtn.dataset.tab, x: e.clientX, y: e.clientY };
    render();
  }
  const appBtn = e.target.closest("[data-ws-app]");
  if (appBtn) {
    const [wid, aid] = appBtn.dataset.wsApp.split(":");
    S.activeWorkspaceId = wid; S.activeAppByWorkspace[wid] = aid;
    ui.menu = { kind:"app", appId: aid, x: e.clientX, y: e.clientY };
    save(); render();
  }
  const wsBtn = e.target.closest("[data-ws]");
  if (wsBtn) {
    ui.menu = { kind:"workspace", workspaceId: wsBtn.dataset.ws, x: e.clientX, y: e.clientY };
    render();
  }
}

function onDragStart(e) {
  const ws = e.target.closest("[data-ws]");
  if (ws) { e.dataTransfer.setData("text/crokETT-workspace", ws.dataset.ws); return; }
  const app = e.target.closest("[data-ws-app]");
  if (app) { const [,aid]=app.dataset.wsApp.split(":"); e.dataTransfer.setData("text/crokETT-app", aid); return; }
}

function onDragOver(e) {
  if (e.target.closest("[data-ws], [data-ws-app], [data-ws-drop]")) e.preventDefault();
}

function onDrop(e) {
  const wsId = e.dataTransfer.getData("text/crokETT-workspace");
  const appId = e.dataTransfer.getData("text/crokETT-app");
  e.preventDefault();

  const wsTgt = e.target.closest("[data-ws]");
  if (wsId && wsTgt) { moveWorkspace(wsId, wsTgt.dataset.ws); return; }

  const appTgt = e.target.closest("[data-ws-app]");
  if (appId && appTgt) { moveApp(appId, appTgt.dataset.wsApp.split(":")[1]); return; }

  const dropZone = e.target.closest("[data-ws-drop]");
  if (appId && dropZone) { moveAppToWorkspace(appId, dropZone.dataset.wsDrop); return; }
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
render();
