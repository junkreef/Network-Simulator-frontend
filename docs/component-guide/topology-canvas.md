> 🇯🇵 日本語版はこちら → [topology-canvas.ja.md](./topology-canvas.ja.md)

# Topology Canvas Components

This document covers `Canvas.tsx`, the three custom node components, `NetworkEdge.tsx`, and `NodeContextMenu.tsx`.

---

## `Canvas.tsx`

**Location:** `src/features/topology/Canvas.tsx`

The root of the React Flow canvas. It wires together all node/edge rendering, user interaction events, and the floating node palette.

### State & Store

`Canvas` is stateless except for the context menu position. All topology state comes from `topologyStore`:

```tsx
const {
  nodes, edges,
  onNodesChange, onEdgesChange, onConnect,
  selectNode, selectEdge, addNode,
} = useTopologyStore();
```

Local state for the context menu:

```tsx
const [contextMenu, setContextMenu] = useState<{
  id: string; x: number; y: number;
} | null>(null);
```

### Node Type Registration

Custom node types are memoized to avoid React Flow re-registering them on every render:

```tsx
const nodeTypes = useMemo<NodeTypes>(() => ({
  router: RouterNode,
  host:   HostNode,
  switch: SwitchNode,
}), []);
```

### Edge Type Registration

```tsx
const edgeTypes = useMemo<EdgeTypes>(() => ({
  networkEdge: NetworkEdge,
}), []);
```

All edges in the store are created with `type: 'networkEdge'` so this renderer is always used.

### Key Event Handlers

| Handler | Trigger | Action |
|---|---|---|
| `onNodesChange` | Node drag, select, remove | Passed directly from store to React Flow |
| `onEdgesChange` | Edge select, remove | Passed directly from store to React Flow |
| `onConnect` | User draws a connection between two handles | Store creates a new edge with interface names extracted from handle IDs |
| `onNodeClick` | Click on a node | `selectNode(node.id)`, dismisses context menu |
| `onEdgeClick` | Click on an edge | `selectEdge(edge.id)`, dismisses context menu |
| `onNodeContextMenu` | Right-click on a node | Records click position relative to `.react-flow` bounding box, shows `NodeContextMenu` |
| `onPaneClick` | Click on empty canvas | Clears selection and context menu |

### Context Menu Positioning

```tsx
const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
setContextMenu({
  id: node.id,
  x: event.clientX - pane.left,
  y: event.clientY - pane.top,
});
```

The coordinates are canvas-relative so the menu renders correctly inside the canvas container.

### Canvas Decorations

- **Background**: dot grid pattern, 16px gap, subtle white dots
- **Controls**: zoom/fit controls, interactive toggle hidden
- **MiniMap**: color-coded by node type — router=blue, switch=cyan, host=green

### Floating Node Palette

A toolbar at the bottom of the canvas provides buttons to add nodes:

```tsx
<button onClick={() => addNode('router')}>+ ルーター追加</button>
<button onClick={() => addNode('switch')}>+ スイッチ追加</button>
<button onClick={() => addNode('host')}>+ ホスト追加</button>
```

`addNode(type)` in the store generates a unique ID, auto-names the label (e.g., `Router-C`), and places the node offset from existing nodes.

---

## `CustomNodes.tsx`

**Location:** `src/features/topology/components/CustomNodes.tsx`

Exports three React Flow node renderers. Each component receives `{ id, data, selected }` from React Flow's `NodeProps<T>`.

### Handle Convention

Every port gets **four** `Handle` components — a source and target handle on each side (left and right):

```
Handle id pattern: `${portName}-${left|right}-${src|tgt}`

Examples:
  eth1-left-src   (source handle on the left side of eth1)
  eth1-left-tgt   (target handle on the left side of eth1)
  eth1-right-src  (source handle on the right side of eth1)
  eth1-right-tgt  (target handle on the right side of eth1)
```

Source and target handles are stacked on top of each other at the same position. This allows connections to flow in either direction without the user needing to distinguish source from target.

Once a port is connected (`isConnected === true`), all its handles become non-connectable:

```tsx
isConnectable={!isConnected}
```

Connection detection uses `checkIsPortConnected()`, which checks `edge.data.sourceInterface`, `edge.data.targetInterface`, and the `sourceHandle`/`targetHandle` string prefix against the port name.

---

### `RouterNode`

- **Icon**: `Network` (lucide-react)
- **Status indicator**: `Activity` icon, styled `.up` or `.down`
- **Port list**: iterates `data.interfaces`, renders one port row per interface
- **VLAN subinterfaces**: shown as indented sub-rows under their parent port, displaying `.{vlanId}` and the IP address
- **IP display**: `{ipAddress}/{netmask}` or `no IP` if empty

### `HostNode`

- **Icon**: `Laptop` (lucide-react)
- **Single port**: always `eth1` — IP address shown from `data.ipAddress`
- **VLAN subinterfaces**: same as RouterNode, filtered to `parentInterface === 'eth1'`

### `SwitchNode`

- **Icon**: `Network` (lucide-react)
- **Port list**: iterates `data.interfaces`
- **VLAN label**: shows current mode:
  - Access: `VLAN {vlanId}`
  - Trunk: `Trunk (10,20,...)` or `Trunk (all)` if no IDs set
  - None: `no VLAN`

---

## `NetworkEdge.tsx`

**Location:** `src/features/topology/components/NetworkEdge.tsx`

A custom React Flow edge renderer using a bezier curve with an inline label.

### Path Rendering

```tsx
const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
```

The SVG `<path>` receives CSS classes based on state:
- `selected` — when the edge is clicked/selected
- `dashed` — when no metrics (bandwidth/delay/cost) are configured
- `down` — when `data.status === 'down'`

### Label Rendering

`EdgeLabelRenderer` places a React DOM element at `(labelX, labelY)` in the canvas coordinate space. The label shows:

```
[sourceInterface] - [targetInterface]
      e.g.   eth1 - eth2
```

### Metrics Badge

When any of `bandwidth`, `delay`, or `cost` are set on the edge, a secondary badge appears below the port label:

```
100mbit  |  10ms  |  Cost: 5
```

---

## `NodeContextMenu.tsx`

**Location:** `src/features/topology/components/NodeContextMenu.tsx`

A floating context menu rendered absolutely within the canvas container, positioned at the coordinates recorded by `onNodeContextMenu`.

### Props

```ts
interface NodeContextMenuProps {
  id: string;            // Node ID
  x: number;            // Canvas-relative X
  y: number;            // Canvas-relative Y
  onClickOutside: () => void;
}
```

### Dismiss Behavior

A `mousedown` listener on `document` closes the menu when clicking outside of `menuRef`. This is set up in a `useEffect` and cleaned up on unmount.

### Menu Items

| Item | Condition | Action |
|---|---|---|
| **ターミナルに接続** (Connect Terminal) | Only enabled when `node.data.status === 'up'` | Calls `terminalStore.addSession(nodeId, label)` to open a new terminal tab |
| **ノードを削除** (Delete Node) | Always available | Calls `topologyStore.deleteNode(id)` to remove the node and all connected edges |

The header section shows the node label and an `ONLINE`/`OFFLINE` badge.

---

## Navigation

- [← Overview](./index.md)
- [Panels →](./panels.md)
- [Terminal →](./terminal.md)
- [State Management →](./state.md)
