> 🇯🇵 日本語版はこちら → [panels.ja.md](./panels.ja.md)

# Panels — Header & PropertyPanel

This document covers the two main UI panels: the top `Header` bar and the `PropertyPanel` right sidebar.

---

## `Header.tsx`

**Location:** `src/components/layout/Header.tsx`

The top navigation bar. It owns all topology-level actions — deploy, reset, and destroy.

### Store Dependencies

```tsx
const { nodes, edges, hasChanges, saveState, resetTopologyState } = useTopologyStore();
```

### Buttons

#### 適用 (Apply / Deploy)

The main deploy button. Triggers `handleApply()`:

1. **Build deploy payload** — constructs a `sim-network` topology object from current nodes and edges:
   ```json
   {
     "name": "sim-network",
     "nodes": [{ "name": "router-1", "type": "router", "interfaces": ["eth1","eth2"] }],
     "links": [{ "endpoints": ["router-1:eth1", "host-1:eth1"] }]
   }
   ```
2. **POST `/api/v1/topology/deploy`** — sends the payload to Containerlab via `applyTopology()`. If the topology structure has not changed, the backend returns `status: "skipped"` and the 10-second wait is bypassed.
3. **Wait 10 seconds** (skipped if deploy was skipped) — allows Containerlab containers to initialize daemons before configuration.
4. **Configure each node in parallel** — `POST /api/v1/nodes/{id}/configure` for all nodes concurrently via `Promise.allSettled`. Payloads differ by node type:
   - **Router**: interfaces (IP/mask), VLAN interfaces, OSPF areas, RIP networks, BGP neighbors, static routes
   - **Switch**: per-port VLAN mode (access/trunk/none), VLAN IDs
   - **Host/Terminal**: eth1 IP address, default gateway
5. **Update node statuses to `'up'`** in the store.
6. **`saveState(true)`** — persists deployed state to backend, clears the `hasChanges` indicator.

#### 環境リセット (Environment Reset)

Stops and removes all running containers without resetting the canvas state:

- `POST /api/v1/topology/destroy`
- Updates all node statuses to `'down'` in the store.

#### トポロジ初期化 (Topology Initialize)

Resets everything — destroys containers **and** resets the canvas to the default topology:

- `POST /api/v1/topology/destroy`
- `resetTopologyState()` — calls `DELETE /api/v1/topology/state`, then restores the default 2-router + 1-host canvas.

#### JSON編集 (JSON Editor)

Opens `JsonEditorModal` — allows direct editing and importing of the raw topology JSON.

### Status Indicators

- **未適用 badge** (`hasChanges === true`): shown when the current canvas state differs from the last deployed state. The comparison ignores node positions and runtime statuses (only configuration changes trigger this badge).
- **Toast notifications**: success/error messages appear for 4 seconds after each action.

---

## `PropertyPanel.tsx`

**Location:** `src/components/property/PropertyPanel.tsx`

The right sidebar. Renders different forms depending on what is selected in the canvas.

When nothing is selected, it shows a placeholder message. When a node or edge is selected, it renders the appropriate configuration UI.

### Selection Source

```tsx
const selectedNode = nodes.find(n => n.id === selectedNodeId);
const selectedEdge = edges.find(e => e.id === selectedEdgeId);
```

---

### Router Panel

Shown when a `router` node is selected. Has two top-level tabs:

- **設定 (Config)** — all configuration forms
- **ステータス (Status)** — runtime info fetched from the backend

#### Config Tab Sections

**Interfaces**

A list of `data.interfaces`. Each row shows:
- Interface name (e.g., `eth1`)
- IP/mask input — accepts `address/prefix` format; stored as `ipAddress` + `netmask` separately
- Admin state toggle (UP ↔ DOWN) — calls `POST /api/v1/nodes/{id}/interfaces/{name}/state`

**VLAN Subinterfaces**

Lists `data.vlanInterfaces`. Each row has inline editing for `vlanId` and `ipAddress` (CIDR). A form at the bottom adds new subinterfaces (parent port selector, VLAN ID, IP).

**OSPF**

- Enable toggle → `routing.ospf.enabled`
- Router ID input → `routing.ospf.routerId`
- Areas list: each area has `areaId`, `interfaces[]` (multi-select from available interfaces), `areaType`, and `ranges[]` for route summarization
- Redistribute: connected / static / RIP / BGP checkboxes
- Default-information originate: enable + `always` flag

**RIP**

- Enable toggle → `routing.rip.enabled`
- Networks list (CIDR strings)
- Redistribute: connected / static / OSPF / BGP checkboxes

**BGP**

- Enable toggle → `routing.bgp.enabled`
- AS Number → `routing.bgp.asNumber`
- Router ID → `routing.bgp.routerId`
- Neighbors list: IP + Remote-AS pairs
- Redistribute: connected / static / OSPF / RIP checkboxes

**Static Routes**

A list of `{ destination, nextHop }` pairs. Add/remove rows.

#### Status Tab

Fetches live runtime data via `GET /api/v1/nodes/{id}/runtime-info?type={type}`.

Available types (selectable in the UI):
- `routing_table`
- `arp`
- `ospf_neighbors`
- `bgp_summary`
- `rip_status`

Output is displayed as raw text in a monospace area.

---

### Switch Panel

Shown when a `switch` node is selected.

**Per-port VLAN configuration**: for each interface in `data.interfaces`:
- **VLAN Mode** selector: `none` / `access` / `trunk`
- **Access VLAN ID**: number input (shown when mode is `access`)
- **Trunk VLAN IDs**: comma-separated number input (shown when mode is `trunk`)

Changes are written immediately to `updateNodeData` in the store and take effect on the next deploy.

---

### Host / Terminal Panel

Shown when a `host` node is selected.

- **IP Address** (CIDR): `data.ipAddress`, e.g. `192.168.1.10/24`
- **Default Gateway**: `data.gateway`, e.g. `192.168.1.1`
- **Admin State toggle** for `eth1`: calls `POST /api/v1/nodes/{id}/interfaces/eth1/state`

---

### Edge Panel

Shown when an edge is selected.

- **Source port** and **target port** labels (read-only, from `data.sourceInterface` / `data.targetInterface`)
- **Bandwidth** input — free-text (e.g., `100mbit`, `1gbit`); stored in `data.bandwidth`
- **Delay** input — free-text (e.g., `10ms`); stored in `data.delay`
- **OSPF Cost** — numeric; stored in `data.cost`
- **Link state toggle** (shown when topology is deployed): calls `setInterfaceState` on the source node's interface to bring the link up or down. Updates `data.status` on the edge and `adminState` on the corresponding node interface.
- **Delete button** — removes the edge via `deleteEdge(edgeId)`

---

## Navigation

- [← Overview](./index.md)
- [Topology Canvas →](./topology-canvas.md)
- [Terminal →](./terminal.md)
- [State Management →](./state.md)
