// ── CATALOG & DEFAULTS ──────────────────────────────────────────────────────

const appCatalog = [
  { id: "gmail",    name: "Gmail",    url: "https://mail.google.com",         color: "#d94f43", splittable: true },
  { id: "github",   name: "GitHub",   url: "https://github.com",              color: "#24292f", splittable: true },
  { id: "slack",    name: "Slack",    url: "https://slack.com/signin",        color: "#4a154b", splittable: true },
  { id: "notion",   name: "Notion",   url: "https://www.notion.so",           color: "#111111", splittable: true },
  { id: "calendar", name: "Calendar", url: "https://calendar.google.com",     color: "#3478f6", splittable: true },
  { id: "linear",   name: "Linear",   url: "https://linear.app",              color: "#5e6ad2", splittable: true },
  { id: "chatgpt",  name: "ChatGPT",  url: "https://chatgpt.com",             color: "#10a37f", splittable: true }
];

const defaultWorkspaces = [
  { id: "work",     name: "Work",     icon: "W", color: "#2f80ed" },
  { id: "personal", name: "Personal", icon: "P", color: "#ffffff" },
  { id: "focus",    name: "Focus",    icon: "F", color: "#e5484d" }
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
  sidebarCollapsed: false, hideTopBar: false, secretsHidden: false, showHiddenApps: false, hideCachableApps: false,
  workspaces: defaultWorkspaces, activeWorkspaceId: "work",
  appsByWorkspace: defaultAppsByWorkspace,
  activeAppByWorkspace: { work: "gmail", personal: "notion", focus: "calendar" },
  tabsByApp: {}
};

let ui = { menu: null, propertiesAppId: null, propertiesWorkspaceId: null, shareDraft: null, activeTabId: null, toast: null };

let S = loadState();
const root = document.getElementById("app");
let wvFrame = null;
S.settingsOpen = false;

let lastRenderState = { sidebarKey: null, toolbarKey: null, tabbarKey: null, chromeKey: null };
const faviconMemo = new Map();

if (navigator.userAgent.includes("Mac")) document.body.classList.add("platform-mac");

function loadState() {
  try {
    const raw = localStorage.getItem("crokETT.state") || localStorage.getItem("cookiers.state");
    const stored = JSON.parse(raw);
    return migrate(stored?.workspaces ? stored : STARTER);
  } catch { return migrate(STARTER); }
}

function save() { localStorage.setItem("crokETT.state", JSON.stringify(S)); }
function commit() { save(); render(); }

function migrate(raw) {
  const s = structuredClone(raw);
  s.density ||= "normal"; s.skin ||= "biscuit"; s.customSkin ||= STARTER.customSkin;
  s.settingsOpen = false; s.settingsSection ||= "general";
  s.maskUrl = Boolean(s.maskUrl);
  s.groupIconSize = clamp(s.groupIconSize, 14, 72, 22);
  s.appIconSize = clamp(s.appIconSize, 12, 58, 17);
  s.splitView = Boolean(s.splitView); s.splitLeftAppId ||= ""; s.splitRightAppId ||= "";
  s.splitOrientation = ["horizontal","vertical"].includes(s.splitOrientation) ? s.splitOrientation : "horizontal";
  s.downloadsPath ||= ""; s.askDownloadLocation = s.askDownloadLocation !== false;
  s.globalNotifications = s.globalNotifications !== false;
  s.notificationSound = Boolean(s.notificationSound); s.notificationBadges = s.notificationBadges !== false;
  s.shortcutsEnabled = s.shortcutsEnabled !== false; s.compactShortcuts = Boolean(s.compactShortcuts);
  s.cameraPermission = normPerm(s.cameraPermission);
  s.microphonePermission = normPerm(s.microphonePermission);
  s.locationPermission = normPerm(s.locationPermission);
  s.fontScale = clamp(s.fontScale, 80, 130, 100);
  s.uiFont = ["system","sans","serif","mono"].includes(s.uiFont) ? s.uiFont : "system";
  s.syncEnabled = Boolean(s.syncEnabled); s.adBlockEnabled = Boolean(s.adBlockEnabled);
  s.chromeExtensions ||= []; s.rssFeedsByTab ||= {};
  s.sidebarCollapsed = Boolean(s.sidebarCollapsed);
  s.hideTopBar = Boolean(s.hideTopBar);
  s.secretsHidden = Boolean(s.secretsHidden); s.showHiddenApps = Boolean(s.showHiddenApps); s.hideCachableApps = Boolean(s.hideCachableApps);

  s.workspaces ||= structuredClone(defaultWorkspaces);
  s.workspaces.forEach((ws, i) => {
    ws.id ||= defaultWorkspaces[i]?.id || `ws-${i}`;
    ws.name ||= defaultWorkspaces[i]?.name || `Workspace ${i+1}`;
    ws.icon ||= "";
    ws.color ||= "#999";
    ws.collapsed = Boolean(ws.collapsed);
    ws.highlightColor ||= "transparent";
    ws.iconImage ||= "";
  });

  s.workspaces.forEach(w => {
    if (!Array.isArray(s.appsByWorkspace[w.id]) || !s.appsByWorkspace[w.id].length)
      s.appsByWorkspace[w.id] = structuredClone(defaultAppsByWorkspace[w.id] || []);
  });

  Object.keys(s.appsByWorkspace || {}).forEach(wid => {
    const apps = Array.isArray(s.appsByWorkspace[wid]) ? s.appsByWorkspace[wid] : [];
    s.appsByWorkspace[wid] = apps.map(a => ({
      notifications: true, notificationCount: 0, hidden: false, cachable: false,
      priority: 0, secret: false, maskUrl: false, splittable: true, iconImage: "", highlightColor: "", color: "#e16f43",
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

// ── HELPERS ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function clamp(v, min, max, def) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; }
function normPerm(v) { return ["ask","allow","block"].includes(v) ? v : "ask"; }
function normUrl(u) { try { return new URL(u).toString(); } catch { return u; } }
function hostname(url) { try { return new URL(url).hostname; } catch { return ""; } }
function initials(name) { return String(name).split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase(); }
function favicon(url) {
  if (faviconMemo.has(url)) return faviconMemo.get(url);
  const d = hostname(url);
  const result = d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : "";
  faviconMemo.set(url, result);
  return result;
}

function activeWorkspace() { return S.workspaces.find(w => w.id === S.activeWorkspaceId) || S.workspaces[0]; }
function activeApp() { const ws = activeWorkspace(); const appId = S.activeAppByWorkspace[ws.id]; return findApp(appId); }
function activeApps() { const ws = activeWorkspace(); return S.appsByWorkspace[ws.id] || []; }
function findApp(id) { for (const apps of Object.values(S.appsByWorkspace)) { const a = apps.find(x => x.id === id); if (a) return a; } return null; }
function findWorkspace(id) { return S.workspaces.find(w => w.id === id); }
function findWorkspaceForApp(appId) { for (const w of S.workspaces) { if ((S.appsByWorkspace[w.id] || []).some(a => a.id === appId)) return w; } return null; }
function tabsFor(appId) { return S.tabsByApp[appId] || []; }
function visibleTabs(appId) { return tabsFor(appId).filter(t => !S.secretsHidden || !t.secret); }
function activeTab() {
  const app = activeApp();
  const tabs = app ? visibleTabs(app.id) : [];
  const t = tabs.find(t => t.id === ui.activeTabId) || tabs[0];
  ui.activeTabId = t.id;
  return t;
}
function activeWorkspaceApps() {
  const ws = activeWorkspace();
  return (S.appsByWorkspace[ws.id] || [])
    .filter(a => (S.showHiddenApps || !a.hidden) && (!S.hideCachableApps || !a.cachable))
    .map(a => ({ workspaceId: ws.id, app: a }));
}

function splitPane(side) {
  if (!S.splitView) return null;
  const apps = activeWorkspaceApps();
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
function setSplitPaneApp(side, appId) {
  if (side === "left") S.splitLeftAppId = appId;
  else S.splitRightAppId = appId;
  commit();
}
function toggleSplitView() {
  if (!S.splitView && activeApp()?.splittable === false) return;
  S.splitView = !S.splitView;
  if (S.splitView) {
    const l = splitPane("left"), r = splitPane("right");
    S.splitLeftAppId = l?.app.id || activeApp()?.id || "";
    S.splitRightAppId = r?.app.id || "";
  }
  commit();
}
function updateSplitPaneUrl(side, url) {
  const paneAppId = side === "left" ? S.splitLeftAppId : S.splitRightAppId;
  if (!paneAppId) return;
  const tab = visibleTabs(paneAppId)[0];
  if (tab) tab.url = normUrl(url);
  commit();
}
function toggleWorkspaceCollapsed(wid) {
  const ws = findWorkspace(wid);
  if (ws) { ws.collapsed = !ws.collapsed; save(); }
}
function addWorkspace() {
  const newId = `ws-${Date.now()}`;
  S.workspaces.push({ id: newId, name: "New Workspace", icon: "", color: "#999", collapsed: false, highlightColor: "", iconImage: "" });
  S.appsByWorkspace[newId] = [];
  S.activeAppByWorkspace[newId] = null;
  selectWorkspace(newId);
}
function updateWorkspaceProperties(wsId, fd) {
  const ws = findWorkspace(wsId); if (!ws) return;
  ws.name = String(fd.get("name") || ws.name).trim();
  ws.icon = String(fd.get("icon") || "").trim();
  ws.color = String(fd.get("color") || ws.color);
  ws.highlightColor = String(fd.get("highlightColor") || "");
  const imgFile = fd.get("iconImage");
  if (imgFile instanceof File && imgFile.size > 0) {
    const reader = new FileReader();
    reader.onload = () => { ws.iconImage = reader.result; save(); render(); };
    reader.readAsDataURL(imgFile);
  }
  ui.propertiesWorkspaceId = null; commit();
}
function addApp(name, url) {
  if (!name || !url) return;
  const newId = `app-${Date.now()}`;
  const app = { id: newId, name: String(name).trim(), url: normUrl(url), color: "#e16f43", priority: 0, notifications: true, notificationCount: 0, highlightColor: "", iconImage: "", cachable: false, hidden: false, secret: false, maskUrl: false, partitionKey: "", splittable: true };
  activeApps().push(app);
  S.tabsByApp[newId] = [{ id: `${newId}-home`, title: app.name, url: app.url, secret: false, muted: false, pinned: false }];
  selectApp(newId);
}
function updateAppProperties(appId, fd) {
  const app = findApp(appId); if (!app) return;
  app.name = String(fd.get("name") || app.name).trim();
  app.url = normUrl(fd.get("url")); app.color = String(fd.get("color") || app.color);
  app.highlightColor = String(fd.get("highlightColor") || ""); app.iconImage = String(fd.get("iconImage") || "").trim();
  app.notifications = fd.get("notifications") === "on"; app.notificationCount = Number(fd.get("notificationCount") || 0);
  app.priority = Number(fd.get("priority") || 0); app.cachable = fd.get("cachable") === "on";
  app.hidden = fd.get("hidden") === "on"; app.secret = fd.get("secret") === "on"; app.maskUrl = fd.get("maskUrl") === "on";
  app.splittable = fd.get("splittable") === "on";
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
  const sharedKey = app.partitionKey || appId;
  const copy = { ...app, id:`${appId}-copy-${Date.now()}`, name:`${app.name} 2`, hidden: false, partitionKey: sharedKey };
  S.appsByWorkspace[S.activeWorkspaceId] = [...activeApps(), copy];
  S.tabsByApp[copy.id] = [{ id:`${copy.id}-home`, title: copy.name, url: copy.url, secret: false, muted: false, pinned: false }];
  selectApp(copy.id);
}
function addTab(appId, secret = false) {
  if (!appId) return;
  const app = findApp(appId); if (!app) return;
  const newId = `${appId}-${Date.now()}`;
  const tabs = tabsFor(appId);
  tabs.push({ id: newId, title: app.name, url: app.url, secret, muted: false, pinned: false });
  S.activeAppByWorkspace[S.activeWorkspaceId] = appId;
  ui.activeTabId = newId;
  commit();
}
function closeTab(tabId) {
  const app = activeApp(); if (!app) return;
  const tabs = tabsFor(app.id);
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx < 0 || tabs.length <= 1) return;
  tabs.splice(idx, 1);
  ui.activeTabId = tabs[0].id;
  commit();
}
function applyChrome() {
  const chromeKey = `${S.density}|${S.skin}|${S.groupIconSize}|${S.appIconSize}|${S.fontScale}|${S.uiFont}|${S.customSkin.cream}|${S.customSkin.sidebar}|${S.customSkin.accent}`;
  if (lastRenderState.chromeKey === chromeKey) return;
  lastRenderState.chromeKey = chromeKey;

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
  const shellCls = ["shell", S.sidebarCollapsed?"sidebar-icons":"", S.hideTopBar?"hide-top-bar":"", S.secretsHidden?"secrets-hidden":"", S.maskUrl?"url-masked":"", splitReady?"split-view":"", splitReady&&S.splitOrientation==="vertical"?"split-bottom":""].filter(Boolean).join(" ");
  const menu = ui.menu;

  if (!wvFrame) {
    root.innerHTML = `<main></main><div id="overlays"></div>`;
    root.querySelector("main").innerHTML = `
      <aside class="app-sidebar unified-sidebar"></aside>
      <section class="browser">
        <div class="toolbar"></div>
        <div class="tabbar"></div>
        <div class="web-stage"><div class="web-frame"></div></div>
        <button class="topbar-toggle-float" data-toggle="hideTopBar" title="Masquer/Afficher la barre"></button>
      </section>`;
    wvFrame = root.querySelector(".web-frame");
  }

  root.querySelector("main").className = shellCls;
  const floatToggle = root.querySelector(".topbar-toggle-float");
  if (floatToggle) { floatToggle.textContent = S.hideTopBar ? "⌃" : "⌄"; floatToggle.title = S.hideTopBar ? "Afficher la barre" : "Masquer la barre"; }

  const sidebarKey = JSON.stringify([S.workspaces, S.appsByWorkspace, S.showHiddenApps, S.hideCachableApps, ws.id, app?.id]);
  if (lastRenderState.sidebarKey !== sidebarKey) {
    lastRenderState.sidebarKey = sidebarKey;
    root.querySelector(".app-sidebar").innerHTML = `
    <div class="mac-titlebar"></div>
    <section class="sidebar-section">
      ${S.workspaces.map((g, gi) => {
        const gApps = (S.appsByWorkspace[g.id] || []).filter(a => (S.showHiddenApps || !a.hidden) && (!S.hideCachableApps || !a.cachable));
        const col = Boolean(g.collapsed);
        return `
          <div class="unified-group${col?" collapsed":""}" data-ws-drop="${esc(g.id)}">
            <div class="unified-group-row${g.id === ws.id?" active":""}">
              <button class="outliner-toggle" data-toggle-ws="${esc(g.id)}" title="${col?"Déplier":"Replier"}">${col?"▸":"▾"}</button>
              <button class="unified-group-title" draggable="true" data-ws="${esc(g.id)}" title="${esc(g.name)} - Cmd/Ctrl+${gi+1}" style="--highlight:${esc(g.highlightColor||"transparent")}">
                ${g.iconImage?`<img src="${esc(g.iconImage)}" alt="" />`:`<span class="group-glyph">${esc(g.icon||"")}</span>`}
                <span>${esc(g.name)}${gApps.length?` (${gApps.length})`:""}</span>
              </button>
            </div>
            <div class="app-list"${col?" hidden":""}>
              ${gApps.map(a => {
                const icon = a.iconImage || favicon(a.url);
                const active = g.id === ws.id && app?.id === a.id;
                const isClone = Boolean(a.partitionKey && a.partitionKey !== a.id);
                return `
                  <button class="app-button cookie-app${active?" active":""}${a.hidden?" hidden-app":""}${a.cachable?" cachable-app":""}${isClone?" clone-app":""}" draggable="true" data-ws-app="${esc(g.id)}:${esc(a.id)}" title="${esc(a.name)}${isClone?` · Clone · Réf: ${esc(a.id)}`:` · Réf: ${esc(a.id)}`}" style="--highlight:${esc(a.highlightColor||"transparent")}">
                    <span class="app-icon-wrap">
                      <span class="app-icon" style="background:${esc(a.color)}">${icon?`<img src="${esc(icon)}" alt="" />`:`${esc(initials(a.name))}`}</span>
                      ${badge(a)}
                      ${isClone?`<span class="clone-badge" title="Clone de ${esc(a.partitionKey||a.id)}">⊕</span>`:""}
                    </span>
                    <span class="app-copy"><span class="app-name">${esc(a.name)}</span></span>
                  </button>`;
              }).join("")}
            </div>
          </div>`;
      }).join("")}
    </section>
    <div class="cookie-footer">
      <button data-add-ws>+ Groupe</button>
      <button class="cookie-add-app" data-open-add>+ App</button>
      <button data-toggle-cachable>${S.hideCachableApps?"Afficher":"Masquer"}</button>
      <button data-open-settings="general">⚙ Réglages</button>
    </div>
    <button class="sidebar-collapse-btn" data-toggle="sidebarCollapsed" title="${S.sidebarCollapsed?"Déplier la colonne":"Réduire la colonne"}">${S.sidebarCollapsed?"›":"‹"}</button>`;
  }

  const toolbarKey = JSON.stringify([tab?.url, maskUrl, S.splitView, splitReady]);
  if (lastRenderState.toolbarKey !== toolbarKey) {
    lastRenderState.toolbarKey = toolbarKey;
    root.querySelector(".toolbar").innerHTML = `
    <div class="nav-controls">
      <button class="icon-button" data-nav="back" title="Retour">←</button>
      <button class="icon-button" data-nav="forward" title="Avant">→</button>
      <button class="icon-button" data-nav="reload" title="Recharger">↻</button>
    </div>
    <form class="address-form" data-url-form>
      <span>URL</span>
      <input name="url" value="${esc(maskUrl ? hostname(tab?.url||"") : tab?.url||"")}" autocomplete="off" spellcheck="false" ${maskUrl?"readonly":""} />
    </form>
    <div class="right-controls">
      <button class="icon-button" data-new-tab title="Nouvel onglet">+</button>
      <button class="icon-button" data-share title="Partager">⇪</button>
      <button class="icon-button${splitReady?" armed":""}${app?.splittable===false?" disabled":""}" data-split-toggle title="${app?.splittable===false?"App non-splittable":"Double vue"}">Ⅱ</button>
      <button class="icon-button page-menu-button" data-page-menu-btn title="Page">☰</button>
      <button class="icon-button" data-appbar-menu-btn title="App & groupe">⊙</button>
      <button class="icon-button" data-open-settings="general" title="Paramètres">⚙</button>
      <button class="icon-button" data-external title="Ouvrir navigateur">↗</button>
    </div>`;
  }

  const tabbarKey = JSON.stringify(vtabs.map(t => `${t.id}:${t.title}:${t.secret}:${t.pinned}:${t.muted}`).join(","));
  if (lastRenderState.tabbarKey !== tabbarKey) {
    lastRenderState.tabbarKey = tabbarKey;
    root.querySelector(".tabbar").innerHTML = vtabs.map(t => `
    <button class="tab${t.id===ui.activeTabId?" active":""}${t.secret?" secret":""}${t.pinned?" pinned":""}${t.muted?" muted":""}" data-tab="${esc(t.id)}">
      <span class="tab-title">${t.pinned?`<span class="tab-flag tab-flag-pin" title="Épinglé">▲</span>`:""}${t.muted?`<span class="tab-flag tab-flag-mute" title="Muet">◉</span>`:""}${t.secret?`<span class="tab-flag tab-flag-secret" title="Secret">◈</span>`:""}${esc(t.title)}</span>
      <span class="tab-menu-trigger" data-tab-menu="${esc(t.id)}">⌄</span>
      <span class="tab-close" data-close-tab="${esc(t.id)}">×</span>
    </button>`).join("");
  }

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
  `;

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
      let section = frame.querySelector(`[data-split-pane="${side}"]`);
      if (!section) {
        section = document.createElement("section");
        section.className = "split-pane";
        section.dataset.splitPane = side;
        frame.appendChild(section);
      }
      let toolbar = section.querySelector(".split-pane-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.className = "split-pane-toolbar";
        section.insertBefore(toolbar, section.firstChild);
      }
      const apps = activeWorkspaceApps();
      const selId = pane?.app?.id || "";
      const select = toolbar.querySelector("select");
      if (!select || select.dataset.splitSelect !== side || select.value !== selId) {
        const newSel = document.createElement("select");
        newSel.dataset.splitSelect = side;
        newSel.innerHTML = apps.map(i => `<option value="${esc(i.app.id)}"${i.app.id===selId?" selected":""}>${esc(i.app.name)}</option>`).join("");
        if (select) select.replaceWith(newSel);
        else toolbar.insertBefore(newSel, toolbar.firstChild);
      }
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
        }
        const newClass = `active pane-${side}`;
        if (wv.className !== newClass) wv.className = newClass;
        if (wv.dataset.muted !== (pTab.muted ? "true" : "false")) wv.dataset.muted = pTab.muted ? "true" : "false";
        if (wv.parentElement !== section) section.appendChild(wv);
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
    frame.querySelectorAll(":scope > webview").forEach(wv => {
      if (wv.dataset.tabId !== lTabId && wv.dataset.tabId !== rTabId) wv.remove();
    });
  } else {
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
            frame.appendChild(wv);
          }
          const wvClass = t.id === ui.activeTabId ? "active pane-left" : "";
          if (wv.className !== wvClass) wv.className = wvClass;
          if (wv.dataset.muted !== (t.muted ? "true" : "false")) wv.dataset.muted = t.muted ? "true" : "false";
        });
      }
    } else {
      const box = document.createElement("div");
      box.className = "empty-state";
      box.innerHTML = `<div class="empty-box"><h1>${S.secretsHidden?"Onglets secrets cachés":"Ajoute une app"}</h1><p>${S.secretsHidden?"Cmd/Ctrl+Shift+H les réaffiche.":"CrokETT organise les apps web par workspace."}</p><button class="primary" data-open-add>Ajouter</button></div>`;
      frame.appendChild(box);
    }
  }
}

function wireWebviews() {
  root.querySelectorAll("webview:not([__wired])").forEach(wv => {
    wv.setAttribute("__wired", "");
    wv.addEventListener("context-menu", (e) => {
      ui.menu = { kind: "page", x: e.params.x, y: e.params.y };
      ui.menu.wv = wv;
      render();
    });
    wv.addEventListener("did-start-loading", () => { if (wv.classList.contains("active")) root.querySelector(".browser")?.classList.add("loading"); });
    wv.addEventListener("did-stop-loading", () => { if (wv.classList.contains("active")) root.querySelector(".browser")?.classList.remove("loading"); });
    wv.addEventListener("did-finish-load", () => {
      hookNotifications(wv);
      applyAdBlock(wv);
      applyMute(wv);
      injectWebviewFont(wv);
    });
  });
}

function injectWebviewFont(wv) {
  if (!S.uiFont || S.uiFont === "system") return;
  const map = { sans: "'Helvetica Neue',Arial,sans-serif", serif: "Georgia,'Times New Roman',serif", mono: "'Courier New',Courier,monospace" };
  const fam = map[S.uiFont]; if (!fam) return;
  wv.insertCSS(`body,p,div,span,a,h1,h2,h3,h4,h5,h6,button,input,textarea,select{font-family:${fam}!important}`).catch(()=>{});
}

function hookNotifications(wv) {
  if (!S.globalNotifications) return;
  wv.executeJavaScript(`
    window.Notification = window.Notification || class {
      constructor(title, opts) {
        this.title = title;
        this.options = opts;
        window.__notifyCount = (window.__notifyCount || 0) + 1;
      }
    };
  `).catch(()=>{});
}

function applyAdBlock(wv) {}
function applyMute(wv) {
  const tab = tabsFor(wv.dataset.appId).find(t => t.id === wv.dataset.tabId);
  if (tab?.muted && typeof wv.setAudioMuted === "function") wv.setAudioMuted(true);
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

function renderAddModal() {
  if (!document.getElementById("add-modal")?.classList.contains("open")) return "";
  return `<div class="modal-backdrop open" id="add-modal">
    <form class="modal" data-add-form>
      <div class="modal-header"><h2>Ajouter une app</h2><button type="button" class="modal-close" data-close-add>×</button></div>
      <div class="field"><label>Nom<input name="appName" required /></label></div>
      <div class="field"><label>URL<input name="appUrl" type="url" required /></label></div>
      <div class="modal-actions"><button type="button" class="secondary" data-close-add>Annuler</button><button type="submit" class="primary">Ajouter</button></div>
    </form>
  </div>`;
}

function renderPropertiesModal() {
  const app = ui.propertiesAppId ? findApp(ui.propertiesAppId) : null;
  if (!app) return "";
  const isClone = Boolean(app.partitionKey && app.partitionKey !== app.id);
  return `<div class="modal-backdrop open" id="properties-modal">
    <form class="modal props-modal" data-props-form data-app-id="${esc(app.id)}">
      <div class="props-header">
        <span class="app-icon large" style="background:${esc(app.color)}">${esc(initials(app.name))}</span>
        <div class="props-header-info">
          <strong>${esc(app.name)}</strong>
          <small>${esc(hostname(app.url))}</small>
          ${isClone?`<span class="clone-info">⊕ Clone</span>`:""}
          <code class="props-ref" onclick="this.select()">${esc(app.id)}</code>
        </div>
        <button type="button" class="props-close" data-close-props>×</button>
      </div>
      <div class="props-section">
        <div class="props-section-label">Essentiel</div>
        <div class="field"><label>Nom<input name="name" value="${esc(app.name)}" required /></label></div>
        <div class="field"><label>URL<input name="url" value="${esc(app.url)}" required /></label></div>
      </div>
      <div class="props-section">
        <div class="props-section-label">Apparence</div>
        <div class="props-color-row">
          <label class="props-color-label">Couleur<input name="color" type="color" value="${esc(app.color)}" /></label>
          <label class="props-color-label">Highlight<input name="highlightColor" type="color" value="${esc(app.highlightColor||"")}" /></label>
        </div>
      </div>
      <div class="props-section">
        <div class="props-section-label">Comportement</div>
        <div class="props-checks">
          <label class="check-row"><input type="checkbox" name="notifications"${app.notifications?" checked":""}> Notifications</label>
          <label class="check-row"><input type="checkbox" name="cachable"${app.cachable?" checked":""}> Cachable</label>
          <label class="check-row"><input type="checkbox" name="hidden"${app.hidden?" checked":""}> Cachée</label>
          <label class="check-row"><input type="checkbox" name="secret"${app.secret?" checked":""}> Secret</label>
          <label class="check-row"><input type="checkbox" name="maskUrl"${app.maskUrl?" checked":""}> Masquer URL</label>
          <label class="check-row"><input type="checkbox" name="splittable"${app.splittable!==false?" checked":""}> Splittable</label>
        </div>
      </div>
      <div class="modal-actions split">
        <button type="button" class="danger" data-delete-app="${esc(app.id)}">Supprimer</button>
        <span></span>
        <button type="button" class="secondary" data-close-props>Annuler</button>
        <button type="submit" class="primary">Enregistrer</button>
      </div>
    </form>
  </div>`;
}

function renderWorkspaceModal() {
  const ws = ui.propertiesWorkspaceId ? findWorkspace(ui.propertiesWorkspaceId) : null;
  if (!ws) return "";
  return `<div class="modal-backdrop open" id="workspace-modal">
    <form class="modal" data-ws-form data-ws-id="${esc(ws.id)}">
      <div class="modal-header"><h2>Propriétés du groupe</h2><button type="button" class="modal-close" data-close-ws>×</button></div>
      <div class="field"><label>Nom<input name="name" value="${esc(ws.name)}" required /></label></div>
      <div class="field"><label>Icône<input name="icon" value="${esc(ws.icon||"")}" maxlength="2" /></label></div>
      <div class="field"><label>Couleur<input name="color" type="color" value="${esc(ws.color)}" /></label></div>
      <div class="modal-actions"><button type="button" class="secondary" data-close-ws>Annuler</button><button type="submit" class="primary">Enregistrer</button></div>
    </form>
  </div>`;
}

function renderShareModal() { return ""; }
function renderSettings() { return ""; }
function renderContextMenu(menu) { return ""; }
function renderTabMenu(menu) { return ""; }
function renderWorkspaceMenu(menu) { return ""; }
function renderPageMenu(menu) { return ""; }
function renderAppBarMenu(menu) { return ""; }

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-close-add]")) { document.getElementById("add-modal")?.classList.remove("open"); return; }
  if (t.closest("[data-close-props]")) { ui.propertiesAppId = null; render(); return; }
  if (t.closest("[data-close-ws]")) { ui.propertiesWorkspaceId = null; render(); return; }
  if (t.closest("[data-close-toast]")) { ui.toast = null; render(); return; }
  if (t.closest("[data-toggle]")) { const btn = t.closest("[data-toggle]"); S[btn.dataset.toggle] = !S[btn.dataset.toggle]; commit(); return; }
  if (t.closest("[data-nav]")) { const nav = t.closest("[data-nav]").dataset.nav; const wv = document.querySelector("webview.active"); if (wv) { if (nav === "back") wv.goBack(); else if (nav === "forward") wv.goForward(); else if (nav === "reload") wv.reload(); } return; }
  if (t.closest("[data-new-tab]")) { addTab(activeApp()?.id); return; }
  if (t.closest("[data-open-add]")) { document.getElementById("add-modal")?.classList.add("open"); return; }
  if (t.closest("[data-tab]")) { const tabId = t.closest("[data-tab]").dataset.tab; ui.activeTabId = tabId; commit(); return; }
  if (t.closest("[data-ws]")) {
    const id = t.closest("[data-ws]").dataset.ws;
    if (id === S.activeWorkspaceId) {
      toggleWorkspaceCollapsed(id);
    } else {
      const ws = findWorkspace(id);
      if (ws?.collapsed) { ws.collapsed = false; save(); }
      selectWorkspace(id);
    }
    return;
  }
  if (t.closest("[data-toggle-ws]")) { toggleWorkspaceCollapsed(t.closest("[data-toggle-ws]").dataset.toggleWs); return; }
  if (t.closest("[data-ws-app]")) {
    const [wid, aid] = t.closest("[data-ws-app]").dataset.wsApp.split(":");
    selectApp(aid, wid); return;
  }
  if (t.closest("[data-split-toggle]")) { toggleSplitView(); return; }
  if (t.closest("[data-add-ws]")) { addWorkspace(); return; }
  if (t.closest("[data-open-settings]")) { S.settingsOpen = !S.settingsOpen; commit(); return; }
  if (t.closest("[data-delete-app]")) {
    const appId = t.closest("[data-delete-app]").dataset.deleteApp;
    deleteApp(appId); return;
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.dataset.addForm) {
    e.preventDefault();
    const fd = new FormData(e.target);
    addApp(fd.get("appName"), fd.get("appUrl"));
    e.target.reset();
    document.getElementById("add-modal")?.classList.remove("open");
    return;
  }
  if (e.target.dataset.propsForm) {
    e.preventDefault();
    updateAppProperties(e.target.dataset.appId, new FormData(e.target));
    return;
  }
  if (e.target.dataset.wsForm) {
    e.preventDefault();
    updateWorkspaceProperties(e.target.dataset.wsId, new FormData(e.target));
    return;
  }
});

document.addEventListener("change", (e) => {
  const sel = e.target.closest("select[data-split-select]");
  if (sel) {
    const side = sel.dataset.splitSelect;
    setSplitPaneApp(side, sel.value);
    return;
  }
});

document.addEventListener("dragstart", (e) => {
  const app = e.target.closest("[data-ws-app]");
  if (app) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("app", app.dataset.wsApp); return; }
});

document.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("app")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
});

document.addEventListener("drop", (e) => {
  const appData = e.dataTransfer.getData("app");
  if (appData) {
    const [oldWid, aid] = appData.split(":");
    const newWid = e.target.closest("[data-ws-drop]")?.dataset.wsDrop;
    if (newWid && newWid !== oldWid) {
      const app = findApp(aid);
      if (app) {
        const oldApps = S.appsByWorkspace[oldWid] || [];
        S.appsByWorkspace[oldWid] = oldApps.filter(a => a.id !== aid);
        const newApps = S.appsByWorkspace[newWid] || [];
        newApps.push(app);
        S.appsByWorkspace[newWid] = newApps;
        commit();
      }
    }
  }
});

render();
