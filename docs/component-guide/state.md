> 🇯🇵 日本語版はこちら → [state.ja.md](./state.ja.md)

# State Management

This document covers all TypeScript types in `types/topology.ts` and the two Zustand stores.

---

## `types/topology.ts`

All data shapes used by nodes and edges in the topology. No runtime logic — pure type definitions.

---

### `InterfaceData`

Represents a physical network interface on a router node.

```ts
interface InterfaceData {
  id: string;           // Unique identifier (same as name, e.g. "eth1")
  name: string;         // Interface name used in Containerlab and FRR configs (e.g. "eth1", "eth2")
  ipAddress: string;    // IPv4 address (e.g. "10.0.0.1") — empty string if unconfigured
  netmask: string;      // Prefix length or dotted mask (e.g. "24") — empty string if unconfigured
  connectedTo?: string; // Node ID of the peer node connected via this interface
  adminState?: 'up' | 'down'; // Current admin state; undefined means not explicitly set
}
```

---

### `VlanInterfaceData`

Represents a 802.1Q VLAN subinterface on a router or host node.

```ts
interface VlanInterfaceData {
  name: string;            // Subinterface name (e.g. "eth1.10")
  parentInterface: string; // Physical parent interface name (e.g. "eth1")
  vlanId: number;          // VLAN tag (1–4094)
  ipAddress: string;       // IP address in CIDR format (e.g. "10.10.10.1/24")
}
```

---

### `OspfAreaConfig`

Configuration for a single OSPF area.

```ts
interface OspfAreaConfig {
  areaId: string;       // Area identifier in dotted-decimal (e.g. "0.0.0.0", "0.0.0.1")
  interfaces: string[]; // Interface names assigned to this area (e.g. ["eth1", "eth2"])
  ranges?: string[];    // Route summarization CIDRs for this area (e.g. ["10.0.0.0/24"])
  areaType?: 'normal' | 'stub' | 'totally-stub' | 'nssa' | 'totally-nssa';
}
```

---

### `RedistributionConfig`

Controls which route sources are redistributed into a routing protocol.

```ts
interface RedistributionConfig {
  connected?: boolean; // Redistribute directly connected routes
  static?: boolean;    // Redistribute static routes
  ospf?: boolean;      // Redistribute routes learned via OSPF
  rip?: boolean;       // Redistribute routes learned via RIP
  bgp?: boolean;       // Redistribute routes learned via BGP
}
```

Used as `redistribute` in `OspfConfig`, `RipConfig`, and `BgpConfig`.

---

### `OspfConfig`

Complete OSPF configuration for a router.

```ts
interface OspfConfig {
  enabled: boolean;
  routerId: string;                // Router ID in dotted-decimal (e.g. "1.1.1.1")
  areas: OspfAreaConfig[];
  redistribute?: RedistributionConfig;
  defaultInformationOriginate?: {
    enabled: boolean;
    always?: boolean;              // Advertise default even if no default route exists locally
    metric?: number;
  };
}
```

**Default (from `initialRouterData`)**: all fields disabled/empty, `areas: []`.

---

### `RipConfig`

Complete RIP configuration for a router.

```ts
interface RipConfig {
  enabled: boolean;
  networks: string[];              // Network CIDRs to advertise (e.g. ["10.0.0.0/24"])
  interfaces?: string[];           // Active interface names for RIP (optional)
  redistribute?: RedistributionConfig;
}
```

---

### `BgpNeighbor`

A single BGP peer.

```ts
interface BgpNeighbor {
  ipAddress: string;  // Peer's IP address
  remoteAs: number;   // Peer's AS number
}
```

---

### `BgpConfig`

Complete BGP configuration for a router.

```ts
interface BgpConfig {
  enabled: boolean;
  asNumber: number;                // Local AS number (default: 65001)
  routerId: string;
  neighbors: BgpNeighbor[];
  redistribute?: RedistributionConfig;
}
```

---

### `StaticRoute`

A single static routing entry.

```ts
interface StaticRoute {
  destination: string; // Destination CIDR (e.g. "172.16.0.0/16")
  nextHop: string;     // Next-hop IP address
}
```

---

### `RouterNodeData`

The full data payload for a `router` type node.

```ts
interface RouterNodeData {
  label: string;                    // Display name (e.g. "Router-A")
  status: 'up' | 'down';           // Runtime status; updated after deploy/destroy
  interfaces: InterfaceData[];      // Physical interfaces (default: eth1–eth4)
  vlanInterfaces: VlanInterfaceData[];
  routing: {
    ospf: OspfConfig;
    rip: RipConfig;
    bgp: BgpConfig;
  };
  staticRoutes: StaticRoute[];
}
```

**Default from `initialRouterData(label)`:**
- 4 interfaces: `eth1` – `eth4`, all empty
- All routing protocols disabled
- Empty static routes, VLAN interfaces

---

### `HostNodeData`

The data payload for a `host` (terminal) type node.

```ts
interface HostNodeData {
  label: string;
  status: 'up' | 'down';
  ipAddress: string;           // CIDR format (e.g. "192.168.1.10/24")
  gateway: string;             // Default gateway IP
  connectedTo?: string;        // Connected peer node ID (via eth1)
  vlanInterfaces: VlanInterfaceData[];
  eth1AdminState?: 'up' | 'down';
}
```

---

### `SwitchInterfaceData`

Per-port data for a switch interface.

```ts
interface SwitchInterfaceData {
  id: string;
  name: string;                      // Port name (e.g. "eth1")
  vlanMode: 'none' | 'access' | 'trunk';
  vlanId?: number;                   // Access VLAN (1–4094); used when mode is 'access'
  vlanIds?: number[];                // Trunk VLAN list; used when mode is 'trunk'
  connectedTo?: string;              // Connected peer node ID
  adminState?: 'up' | 'down';
}
```

---

### `SwitchNodeData`

The data payload for a `switch` type node.

```ts
interface SwitchNodeData {
  label: string;
  status: 'up' | 'down';
  interfaces: SwitchInterfaceData[]; // Default: eth1–eth4, all in 'access' mode, VLAN 1
}
```

---

### `NetworkEdgeData`

Data attached to an edge (link) between two nodes.

```ts
interface NetworkEdgeData {
  bandwidth?: string;         // e.g. "100mbit", "1gbit"
  delay?: string;             // e.g. "10ms"
  cost?: number;              // OSPF link cost
  sourceInterface?: string;   // Interface name on the source node (e.g. "eth1")
  targetInterface?: string;   // Interface name on the target node (e.g. "eth2")
  status?: 'up' | 'down';     // Link state (set via PropertyPanel link toggle)
}
```

---

## `topologyStore.ts` — Zustand Store

**Location:** `src/store/topologyStore.ts`

The single source of truth for all topology state. Created with `zustand/create`.

### State Fields

```ts
interface TopologyState {
  nodes: Node[];               // All React Flow nodes (current canvas state)
  edges: Edge[];               // All React Flow edges (current canvas state)
  deployedNodes: Node[];       // Deep copy of nodes at last successful deploy
  deployedEdges: Edge[];       // Deep copy of edges at last successful deploy
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hasChanges: boolean;         // True when canvas differs from deployed state
  isSaving: boolean;           // True while auto-save is in flight
  // ... actions
}
```

### Auto-Save

Every time `nodes` or `edges` changes, a 2-second debounced auto-save fires:

```ts
// Debounced 2000ms
useTopologyStore.getState().saveState(false)
```

This persists the current (non-deployed) canvas state to `POST /api/v1/topology/state?deployed=false`.

### `hasChanges` Computation

Recomputed automatically on every state update via a wrapped `set` function. Uses `checkHasChanges()` which:
1. Strips `position`, `positionAbsolute`, `width`, `height`, `selected`, `dragging` from nodes
2. Strips `status` from node `data`
3. Strips `selected` from edges
4. Compares sorted JSON strings

This means position-only changes do **not** set `hasChanges` — only configuration changes do.

---

### Actions

#### `addNode(type: 'router' | 'host' | 'switch')`

Creates a new node with a unique timestamp-based ID, auto-assigns the next available label letter (Router-A, Router-B, …), initializes default data, and places it at a cascading offset position.

#### `deleteNode(id: string)`

Removes the node and **all connected edges** from state. Clears `selectedNodeId` if it was the deleted node.

#### `deleteEdge(id: string)`

Removes the edge and clears the `connectedTo` field on both endpoint nodes' matching interfaces.

#### `updateNodeData(nodeId, data)`

Shallow-merges `data` into the node's `data` field. Used extensively by PropertyPanel to apply form changes.

#### `updateEdgeData(edgeId, data)`

Shallow-merges `data` into the edge's `data` field.

#### `addPort(nodeId: string)`

Adds a new interface to a router or switch node. Auto-names it by finding the current highest `eth{N}` number and incrementing:
- Router: new `InterfaceData` with empty IP and netmask
- Switch: new `SwitchInterfaceData` with `vlanMode: 'access'`, `vlanId: 1`

#### `deletePort(nodeId, portName)`

Removes the named interface from the node and removes any edges connected to that port.

#### `onConnect(connection: Connection)`

Called by React Flow when the user draws a new connection. Extracts interface names from handle IDs by stripping the `-left-src`/`-right-tgt` suffix pattern, creates a `networkEdge` typed edge, and updates `connectedTo` on both endpoint nodes.

#### `saveState(deployed?: boolean)`

Calls `POST /api/v1/topology/state?deployed={deployed}` via `saveTopologyState()`. If `deployed === true`, also deep-copies current nodes/edges into `deployedNodes`/`deployedEdges` and clears `hasChanges`.

#### `loadState()`

On page load (`App.tsx` calls this in `useEffect`):
1. Fetches both `GET /topology/state?deployed=false` and `GET /topology/state?deployed=true`
2. Fetches `GET /topology/status` to check which containers are running
3. Merges runtime status into node data (sets `status: 'up'` for running nodes)
4. Recomputes `hasChanges`
5. Updates the store

#### `resetTopologyState()`

1. `DELETE /api/v1/topology/state` — clears persisted state on the backend
2. Restores the hardcoded default canvas: 2 routers + 1 host with 1 edge
3. Clears `deployedNodes`/`deployedEdges`

#### `setDeployedState(nodes, edges)`

Deep-copies the provided arrays into `deployedNodes`/`deployedEdges`. Used after a successful deploy to record the baseline for `hasChanges`.

---

## `terminalStore.ts` — Zustand Store

**Location:** `src/store/terminalStore.ts`

Manages the list of open terminal sessions and which one is currently active.

### `TerminalSession` Interface

```ts
interface TerminalSession {
  nodeId: string;  // The topology node ID (also the key in terminalManager.activeRefs)
  label: string;   // Display name shown on the tab (e.g. "Router-A")
}
```

### State Fields

```ts
sessions: TerminalSession[];    // All open terminal tabs
activeSessionId: string | null; // nodeId of the visible tab
isExpanded: boolean;            // Whether the terminal panel is in expanded mode
```

### Actions

| Action | Behavior |
|---|---|
| `addSession(nodeId, label)` | If the session already exists, just activates it. Otherwise appends and activates. |
| `removeSession(nodeId)` | Removes the session. If it was active, activates the last remaining session (or `null`). |
| `setActiveSessionId(nodeId)` | Switches the visible tab. |
| `setIsExpanded(expanded)` | Toggles the expanded layout. |

> **Note:** `terminalStore` manages the **tab list** only. The actual Xterm.js instances and WebSocket connections are managed by `terminalManager.ts` outside of React state. Closing a tab (via `removeSession`) should always be paired with `closeTerminalSession` from `terminalManager` to avoid WebSocket leaks.

---

## Navigation

- [← Overview](./index.md)
- [Topology Canvas →](./topology-canvas.md)
- [Panels →](./panels.md)
- [Terminal →](./terminal.md)
