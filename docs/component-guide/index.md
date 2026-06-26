> 🇯🇵 日本語版はこちら → [index.ja.md](./index.ja.md)

# Component Guide — Source Overview

This guide gives a full map of the `src/` directory and explains how the major pieces fit together.

---

## `src/` Directory Tree

```
src/
├── App.tsx               # Root component — wraps everything in ReactFlowProvider, calls loadState on mount
├── main.tsx              # React entry point — mounts App into #root
├── api/
│   └── client.ts         # Typed HTTP client for all REST API calls (deploy, configure, state, runtime info)
├── assets/               # Static assets (icons, images)
├── components/           # Shared/layout components
│   ├── json/
│   │   └── JsonEditorModal.tsx  # Modal for viewing/importing topology JSON directly
│   ├── layout/
│   │   └── Header.tsx    # Top navigation bar — Apply, Reset, Destroy buttons and status indicators
│   ├── property/
│   │   └── PropertyPanel.tsx   # Right sidebar — node/edge configuration UI (routing, VLAN, IP, etc.)
│   └── terminal/
│       ├── WebTerminal.tsx     # Multi-tab Xterm.js terminal panel with WebSocket connections
│       └── terminalManager.ts  # Module-level singleton map of live terminal sessions and WebSocket refs
├── features/
│   └── topology/         # Main topology feature module
│       ├── Canvas.tsx    # React Flow canvas — node/edge rendering, event routing, floating node palette
│       ├── Canvas.css
│       └── components/
│           ├── CustomNodes.tsx     # RouterNode, SwitchNode, HostNode — custom React Flow node renderers
│           ├── CustomNodes.css
│           ├── NetworkEdge.tsx     # Custom edge renderer with bezier path, label, and metrics badge
│           ├── NetworkEdge.css
│           ├── NodeContextMenu.tsx # Right-click context menu — Connect Terminal / Delete Node
│           └── NodeContextMenu.css
├── store/
│   ├── topologyStore.ts  # Zustand store — all topology state, actions, auto-save, and deploy logic
│   └── terminalStore.ts  # Zustand store — terminal session list, active session, expanded state
├── styles/
│   └── global.css        # CSS custom properties (color palette, spacing) and base resets
└── types/
    └── topology.ts       # TypeScript interfaces for all topology data: nodes, edges, routing configs
```

---

## Directory Roles

### `api/`
A thin HTTP client layer. All `fetch` calls go through `client.ts` so that the `VITE_API_BASE_URL` environment variable is applied consistently. No UI logic lives here.

### `components/`
Reusable or layout-level components that are not tied to a specific feature. The terminal and property panel are here because they are shared across the topology feature and the header.

### `features/topology/`
The main feature module. `Canvas.tsx` is the primary React Flow host. Custom node and edge renderers live in `components/`. This directory owns all visual topology state rendering.

### `store/`
All global state. `topologyStore.ts` is the single source of truth for nodes, edges, deploy status, and change tracking. `terminalStore.ts` manages the tab list and active terminal session.

### `types/`
Pure TypeScript — no runtime code. All interfaces that describe node data, edge data, and routing protocol configurations live here. Import from this module rather than defining inline types.

---

## Data Flow Summary

```
User interaction (click/drag/connect/type)
        │
        ▼
  Canvas.tsx / PropertyPanel.tsx
  (React Flow events → store actions)
        │
        ▼
  topologyStore.ts  ←──── auto-save (2s debounce)
  (Zustand state)               │
        │                       ▼
        │               POST /api/v1/topology/state
        │
        ▼ (on Deploy button)
  Header.tsx → handleApply()
        │
        ├─ POST /api/v1/topology/deploy  (Containerlab)
        │
        └─ POST /api/v1/nodes/{id}/configure  (per-node, parallel)
                │
                ▼
          FRR / bridge / ip commands inside containers
```

**Terminal path (separate from topology):**

```
Right-click node → NodeContextMenu → terminalStore.addSession(nodeId)
        │
        ▼
  WebTerminal.tsx renders a new tab
        │
        ▼
  terminalManager.createTerminalSession(nodeId)
        │
        ├─ new Terminal() + FitAddon (Xterm.js)
        └─ new WebSocket(ws://host:8000/api/v1/ws/terminal/{nodeId})
              ↕ bidirectional: keystrokes → backend → container stdin/stdout
```

---

## Navigation

- [← Development Guide](../development.md)
- [Topology Canvas →](./topology-canvas.md)
- [Panels (Header & PropertyPanel) →](./panels.md)
- [Terminal →](./terminal.md)
- [State Management →](./state.md)
