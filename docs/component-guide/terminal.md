> 🇯🇵 日本語版はこちら → [terminal.ja.md](./terminal.ja.md)

# Terminal Components

This document covers `WebTerminal.tsx` and `terminalManager.ts`.

---

## Architecture Overview

The terminal subsystem is split into two layers:

| Layer | File | Responsibility |
|---|---|---|
| **UI** | `WebTerminal.tsx` | Renders the tab bar and terminal panels; manages session lifecycle via the store |
| **Session** | `terminalManager.ts` | Creates/destroys Xterm.js + WebSocket pairs; module-level singleton map |
| **State** | `terminalStore.ts` | Zustand store — tab list, active session ID, expanded state |

---

## `terminalManager.ts`

**Location:** `src/components/terminal/terminalManager.ts`

A module-level manager (not a class, not a React component). Keeps a map of live terminal sessions outside of React state to avoid re-creating terminals on re-renders.

### `SessionRefs` Interface

```ts
interface SessionRefs {
  term: Terminal;                              // Xterm.js terminal instance
  fitAddon: FitAddon;                          // Xterm.js addon for auto-resize
  ws: WebSocket;                               // Live WebSocket connection
  onDataDisposable: { dispose: () => void };   // Xterm.js data handler cleanup
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}
```

### Internal Maps

```ts
const activeRefs: Record<string, SessionRefs> = {};
const statusListeners: Record<string, ((status: SessionRefs['status']) => void)[]> = {};
```

`activeRefs` is keyed by `nodeId`. `statusListeners` allows React components to subscribe to connection status changes without polling.

---

### `createTerminalSession(nodeId, label)`

Creates a new terminal session. Returns the existing session immediately if one is already open for `nodeId` (idempotent).

**Steps:**

1. Instantiate `Terminal` with a dark theme (blue cursor, matching app palette)
2. Create and load `FitAddon`
3. Determine WebSocket URL:
   ```ts
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const host = import.meta.env.VITE_WS_HOST || `${window.location.hostname}:8000`;
   const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${nodeId}`;
   ```
4. Set initial status to `'connecting'`, write connecting message to terminal
5. Open WebSocket and register event handlers

**WebSocket Event Handlers:**

| Event | Action |
|---|---|
| `onopen` | Set status `'connected'`, call `fitAddon.fit()`, send `{ event: 'resize', cols, rows }` |
| `onmessage` | Parse JSON; if `{ event: 'output', data }`, write `data` to terminal. Falls back to writing raw message if JSON parse fails. |
| `onerror` | Set status `'error'`, write error message to terminal |
| `onclose` | Set status `'disconnected'`, write close message to terminal |

**Terminal Data Handler:**

```ts
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: 'input', data }));
  }
});
```

All keystrokes from the terminal are wrapped in `{ event: 'input', data }` JSON and sent to the backend, which pipes them to the container's stdin.

---

### `closeTerminalSession(nodeId)`

Closes the WebSocket, disposes the `onData` handler, and calls `term.dispose()`. Removes the entry from `activeRefs` and notifies status listeners with `'disconnected'`.

### `resizeTerminalSession(nodeId)`

Calls `fitAddon.fit()` to recalculate terminal dimensions, then sends `{ event: 'resize', cols, rows }` over the WebSocket if it is open. This keeps the PTY size in sync with the visible terminal area.

### `registerStatusListener(nodeId, listener)`

Subscribes a callback to connection status updates. Returns an unsubscribe function. If a session already exists, the listener is called immediately with the current status.

---

## `WebTerminal.tsx`

**Location:** `src/components/terminal/WebTerminal.tsx`

The top-level terminal UI component. Renders a fixed panel at the bottom of the screen containing a tab bar and one terminal view per open session.

### Store Dependencies

```tsx
const { sessions, activeSessionId, isExpanded, removeSession, setActiveSessionId, setIsExpanded } = useTerminalStore();
const { nodes } = useTopologyStore();
```

### Session Cleanup

When a node is deleted from the topology, its terminal session is automatically cleaned up:

```tsx
useEffect(() => {
  sessions.forEach((session) => {
    const exists = nodes.some((n) => n.id === session.nodeId);
    if (!exists) {
      closeTerminalSession(session.nodeId);
      removeSession(session.nodeId);
    }
  });
}, [nodes, sessions, removeSession]);
```

### Tab Bar

Each `TerminalSession` in `sessions` gets a tab. Clicking a tab calls `setActiveSessionId(nodeId)`. Each tab has an `X` button that calls `closeTerminalSession` and `removeSession`.

A `connection-badge` in the top-right corner shows the current WebSocket state of the active session: `CONNECTED`, `CONNECTING`, `OFFLINE`, or `ERROR`.

### Expand / Collapse

The `isExpanded` flag on `terminalStore` controls whether the terminal panel takes up expanded screen space. Toggling it calls `resizeTerminalSession` after a 100ms delay to allow the DOM to settle before recalculating dimensions.

---

### `TerminalActiveView` (Internal Component)

A private component that mounts a single Xterm.js terminal for a given `nodeId`.

```tsx
function TerminalActiveView({ nodeId, label, isActive }: TerminalActiveViewProps)
```

- On **first mount**: calls `createTerminalSession(nodeId, label)`, then `session.term.open(containerRef.current)` and `session.fitAddon.fit()`.
- **Display toggle**: the wrapper `div` uses `display: block` when active and `display: none` when inactive. This keeps all terminal DOM elements alive in the background — switching tabs does not disconnect or re-create the WebSocket.
- On **becoming active**: triggers `resizeTerminalSession(nodeId)` after 50ms.
- **ResizeObserver**: watches the parent element for size changes and calls `resizeTerminalSession` to keep the PTY dimensions in sync.

---

## Focus Conflict Issue

**Problem**: Xterm.js registers a global `keydown` listener that captures all keyboard input when the terminal element is focused. This can prevent `<input>` elements in `PropertyPanel` from receiving key events — most commonly the `/` character used in CIDR notation (e.g., `192.168.1.0/24`).

**Root cause**: Both the terminal and PropertyPanel inputs can coexist in the DOM at the same time. If the terminal has focus, it intercepts keystrokes before the input field.

**Solution**: Ensure the terminal element does not retain focus when the user intends to type into a form field. Blur the terminal programmatically when inputs in `PropertyPanel` gain focus, or use `pointer-events: none` on the terminal container when it is not the active tab.

When adding new input components to the sidebar or anywhere near the terminal area, test with the terminal panel open and verify that all characters (especially `/`, `-`, and digits) are typed correctly into the intended input.

---

## WebSocket Message Protocol

All messages between the frontend and backend are JSON-encoded:

| Direction | Message | Description |
|---|---|---|
| Frontend → Backend | `{ "event": "input", "data": "ls\r" }` | Keystrokes from terminal |
| Frontend → Backend | `{ "event": "resize", "cols": 120, "rows": 32 }` | Terminal resize |
| Backend → Frontend | `{ "event": "output", "data": "total 8\r\n..." }` | Container stdout/stderr |

---

## Navigation

- [← Overview](./index.md)
- [Topology Canvas →](./topology-canvas.md)
- [Panels →](./panels.md)
- [State Management →](./state.md)
