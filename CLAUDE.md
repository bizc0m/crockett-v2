# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**croKETT** is a multi-app web container built with Electron that allows users to:
- Manage multiple web applications in isolated webview windows
- Organize apps into workspaces (Work, Personal, Focus, etc.)
- Maintain separate cookies/sessions per app or app clone
- Support split-view browsing of two apps side-by-side
- Configure permissions, appearance, and advanced settings globally

Version: 0.2.0 | License: MIT

## Core Commands

```bash
npm start              # Launch the app in dev mode
npm test               # Run tests with Node's built-in test runner
npm run build:mac      # Build macOS app
npm run build:win      # Build Windows app
npm run build:linux    # Build Linux app
npm run pack:clickable # Quick build preview without installer
```

## Architecture Overview

### Entry Point
- **`src/main.js`** — Electron main process
  - Creates and manages the app window
  - Handles IPC communication (copy, open external, extension loading, downloads)
  - Manages permission policies for notifications, camera, microphone, etc.
  - Loads and manages Chrome extensions

### UI Layer
- **`src/renderer/index.html`** — Minimal HTML shell with app mount point
- **`src/renderer/app.js`** — Single-file SPA containing:
  - **State Management**: `S` (persisted to localStorage), `ui` (transient UI state)
  - **Catalog**: Pre-defined app list and default workspaces
  - **Render System**: Main `render()` function checks render keys to avoid full redraws
  - **Mutations**: Functions for state changes (selectWorkspace, addApp, updateAppProperties, etc.)
  - **Render Functions**: Seven modal/menu renderers (settings, share, context menus, tab menus)
  - **Event Handlers**: Click, submit, change, input listeners for all interactions
- **`src/renderer/styles.css`** — Unified theming with CSS variables

### Shared Utilities
- **`src/shared/validation.js`** — Validation helpers (URL normalization, path expansion, filename sanitization)

### State Structure
Key parts of `S` (state):
- `workspaces` — Array of workspace objects (id, name, icon, color, collapsed status)
- `appsByWorkspace` — Map of workspace id → app array
- `activeWorkspaceId`, `activeAppByWorkspace` — Current selection state
- `tabsByApp` — Map of app id → tab array (each tab has url, title, secret flag, muted, pinned)
- `settingsOpen`, `settingsSection` — Settings panel visibility and active tab
- `skin`, `density`, `fontScale` — Appearance settings
- `splitView`, `splitLeftAppId`, `splitRightAppId` — Split-view state
- `downloadPolicy`, `permissionPolicy` — Download and permission settings

## Key Concepts

### Workspaces
Containers for organizing related apps. Each workspace:
- Has visible/hidden state (collapsed)
- Can be customized with icon, name, color
- Contains a list of apps exclusive to that workspace
- Maintains an "active app" for that workspace

### Apps
Web applications loaded in webviews. Each app:
- Has a URL, name, color, and favicon
- Can be marked as "cachable", "secret", "hidden", "splittable"
- Can have a custom partition key (for cookie sharing with clones)
- Maintains a list of tabs (each tab is a browsing session within that app)

### Tabs
Individual browsing sessions within an app. Each tab:
- Has a URL, title, and unique id
- Can be pinned, muted, or marked as secret
- When secret, uses a different partition key for isolation
- Can be duplicated, closed, or have flags toggled

### Rendering Strategy
The `render()` function uses memoization keys to avoid re-rendering unchanged sections:
- `sidebarKey` — Sidebar apps/workspaces tree
- `toolbarKey` — Navigation bar and URL input
- `tabbarKey` — Tab list
- `chromeKey` — Theme and CSS variables

When these keys change, only that section's HTML is regenerated.

## Common Workflows

### Adding a New Setting
1. Add the setting to `STARTER` in app.js (default value)
2. Handle migration in `migrate()` function if needed
3. Add UI in appropriate `renderSettings()` section
4. Add event handler in the `change` listener for `[data-settings-*]` attributes

### Adding a New Menu
1. Create a `renderMenu()` function that returns HTML for menu items
2. Set `ui.menu` to `{ kind: "...", ...contextData }` when menu should open
3. Add click handlers in the click listener with `[data-menu-action]` attributes
4. Update CSS in styles.css for menu positioning and styling

### Creating a Modal
1. Render function checks `ui.propertyId` or `ui.modalState` to determine visibility
2. Return modal HTML with form or controls
3. Add close handlers with `[data-close-*]` buttons
4. Add submit/change handlers to process form data

## File Structure
```
src/
  main.js                 # Electron main process
  preload.cjs            # Preload script for IPC context isolation
  renderer/
    index.html           # Minimal HTML shell
    app.js               # Main app logic (811 lines)
    styles.css           # All UI styling
  shared/
    validation.js        # Shared utilities
tests/
  *.test.mjs            # Test files
package.json            # Dependencies and scripts
```

## Important Notes

### Webview Partition System
Each app maintains cookie isolation via Electron's partition system:
- Default: `persist:crokETT-app-{appId}`
- Clone apps: `persist:crokETT-app-{partitionKey}` (shares cookies with original)
- Secret tabs: `persist:crokETT-secret-{tabId}` (completely isolated)

### Event Flow
1. User clicks element with `data-*` attribute
2. Click handler in app.js matches the attribute and calls mutation function
3. Mutation updates state `S` or transient `ui`
4. `commit()` saves state and calls `render()`
5. `render()` regenerates only changed sections via memoization keys

### CSS Variables
All colors and sizes are themeable via CSS custom properties (see `:root` and skin variants in styles.css). The `applyChrome()` function applies these dynamically based on settings.

### Electron Preload
- Uses context isolation for security
- Only IPC methods exposed: copy-text, open-external, open-new-window, permission/preference management, extension loading
- Webviews communicate through IPC for privileged operations
