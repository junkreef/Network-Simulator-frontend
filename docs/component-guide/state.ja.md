> 🇬🇧 English version available → [state.md](./state.md)

# 状態管理

このドキュメントでは `types/topology.ts` のすべての TypeScript 型と、2 つの Zustand ストアについて説明します。

---

## `types/topology.ts`

トポロジのノードとエッジが使用するすべてのデータ形状です。ランタイムロジックはなく、純粋な型定義のみです。

---

### `InterfaceData`

ルーターノードの物理ネットワークインターフェースを表します。

```ts
interface InterfaceData {
  id: string;           // ユニーク識別子（name と同じ。例：「eth1」）
  name: string;         // Containerlab と FRR 設定で使用するインターフェース名（例：「eth1」「eth2」）
  ipAddress: string;    // IPv4 アドレス（例：「10.0.0.1」）— 未設定の場合は空文字
  netmask: string;      // プレフィックス長またはドット区切りマスク（例：「24」）— 未設定の場合は空文字
  connectedTo?: string; // このインターフェースを通じて接続されているピアノードの ID
  adminState?: 'up' | 'down'; // 現在の管理状態；undefined は明示的に設定されていないことを意味する
}
```

---

### `VlanInterfaceData`

ルーターまたはホストノードの 802.1Q VLAN サブインターフェースを表します。

```ts
interface VlanInterfaceData {
  name: string;            // サブインターフェース名（例：「eth1.10」）
  parentInterface: string; // 物理親インターフェース名（例：「eth1」）
  vlanId: number;          // VLAN タグ（1–4094）
  ipAddress: string;       // CIDR 形式の IP アドレス（例：「10.10.10.1/24」）
}
```

---

### `OspfAreaConfig`

単一の OSPF エリアの設定です。

```ts
interface OspfAreaConfig {
  areaId: string;       // ドット区切り10進数のエリア識別子（例：「0.0.0.0」「0.0.0.1」）
  interfaces: string[]; // このエリアに割り当てるインターフェース名（例：["eth1", "eth2"]）
  ranges?: string[];    // このエリアのルート集約 CIDR（例：["10.0.0.0/24"]）
  areaType?: 'normal' | 'stub' | 'totally-stub' | 'nssa' | 'totally-nssa';
}
```

---

### `RedistributionConfig`

どのルートソースをルーティングプロトコルに再配送するかを制御します。

```ts
interface RedistributionConfig {
  connected?: boolean; // 直結ルートの再配送
  static?: boolean;    // スタティックルートの再配送
  ospf?: boolean;      // OSPF で学習したルートの再配送
  rip?: boolean;       // RIP で学習したルートの再配送
  bgp?: boolean;       // BGP で学習したルートの再配送
}
```

`OspfConfig`・`RipConfig`・`BgpConfig` の `redistribute` として使用されます。

---

### `OspfConfig`

ルーターの完全な OSPF 設定です。

```ts
interface OspfConfig {
  enabled: boolean;
  routerId: string;                // ドット区切り10進数のルーター ID（例：「1.1.1.1」）
  areas: OspfAreaConfig[];
  redistribute?: RedistributionConfig;
  defaultInformationOriginate?: {
    enabled: boolean;
    always?: boolean;              // ローカルにデフォルトルートがなくても広告する
    metric?: number;
  };
}
```

**デフォルト（`initialRouterData` より）**：すべてのフィールドが無効/空、`areas: []`。

---

### `RipConfig`

ルーターの完全な RIP 設定です。

```ts
interface RipConfig {
  enabled: boolean;
  networks: string[];              // 広告するネットワーク CIDR（例：["10.0.0.0/24"]）
  interfaces?: string[];           // RIP のアクティブインターフェース名（オプション）
  redistribute?: RedistributionConfig;
}
```

---

### `BgpNeighbor`

単一の BGP ピアです。

```ts
interface BgpNeighbor {
  ipAddress: string;  // ピアの IP アドレス
  remoteAs: number;   // ピアの AS 番号
}
```

---

### `BgpConfig`

ルーターの完全な BGP 設定です。

```ts
interface BgpConfig {
  enabled: boolean;
  asNumber: number;                // ローカル AS 番号（デフォルト：65001）
  routerId: string;
  neighbors: BgpNeighbor[];
  redistribute?: RedistributionConfig;
}
```

---

### `StaticRoute`

単一のスタティックルートエントリです。

```ts
interface StaticRoute {
  destination: string; // 宛先 CIDR（例：「172.16.0.0/16」）
  nextHop: string;     // ネクストホップ IP アドレス
}
```

---

### `RouterNodeData`

`router` タイプノードの完全なデータペイロードです。

```ts
interface RouterNodeData {
  label: string;                    // 表示名（例：「Router-A」）
  status: 'up' | 'down';           // ランタイム状態；デプロイ/破棄後に更新される
  interfaces: InterfaceData[];      // 物理インターフェース（デフォルト：eth1–eth4）
  vlanInterfaces: VlanInterfaceData[];
  routing: {
    ospf: OspfConfig;
    rip: RipConfig;
    bgp: BgpConfig;
  };
  staticRoutes: StaticRoute[];
}
```

**`initialRouterData(label)` のデフォルト：**
- 4 つのインターフェース：`eth1`–`eth4`（すべて空）
- すべてのルーティングプロトコルは無効
- スタティックルート・VLAN インターフェースは空

---

### `HostNodeData`

`host`（ターミナル）タイプノードのデータペイロードです。

```ts
interface HostNodeData {
  label: string;
  status: 'up' | 'down';
  ipAddress: string;           // CIDR 形式（例：「192.168.1.10/24」）
  gateway: string;             // デフォルトゲートウェイ IP
  connectedTo?: string;        // eth1 経由で接続されているピアノード ID
  vlanInterfaces: VlanInterfaceData[];
  eth1AdminState?: 'up' | 'down';
}
```

---

### `SwitchInterfaceData`

スイッチインターフェースのポートごとのデータです。

```ts
interface SwitchInterfaceData {
  id: string;
  name: string;                      // ポート名（例：「eth1」）
  vlanMode: 'none' | 'access' | 'trunk';
  vlanId?: number;                   // Access VLAN（1–4094）；mode が 'access' の場合に使用
  vlanIds?: number[];                // Trunk VLAN リスト；mode が 'trunk' の場合に使用
  connectedTo?: string;              // 接続されているピアノード ID
  adminState?: 'up' | 'down';
}
```

---

### `SwitchNodeData`

`switch` タイプノードのデータペイロードです。

```ts
interface SwitchNodeData {
  label: string;
  status: 'up' | 'down';
  interfaces: SwitchInterfaceData[]; // デフォルト：eth1–eth4（すべて access モード、VLAN 1）
}
```

---

### `NetworkEdgeData`

2 つのノード間のエッジ（リンク）に付属するデータです。

```ts
interface NetworkEdgeData {
  bandwidth?: string;         // 例：「100mbit」「1gbit」
  delay?: string;             // 例：「10ms」
  cost?: number;              // OSPF リンクコスト
  sourceInterface?: string;   // 送信元ノードのインターフェース名（例：「eth1」）
  targetInterface?: string;   // 送信先ノードのインターフェース名（例：「eth2」）
  status?: 'up' | 'down';     // リンク状態（PropertyPanel のリンクトグルで設定）
}
```

---

## `topologyStore.ts` — Zustand ストア

**場所：** `src/store/topologyStore.ts`

すべてのトポロジ状態の単一情報源です。`zustand/create` で作成されます。

### 状態フィールド

```ts
interface TopologyState {
  nodes: Node[];               // すべての React Flow ノード（現在のキャンバス状態）
  edges: Edge[];               // すべての React Flow エッジ（現在のキャンバス状態）
  deployedNodes: Node[];       // 最後の正常デプロイ時のノードのディープコピー
  deployedEdges: Edge[];       // 最後の正常デプロイ時のエッジのディープコピー
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hasChanges: boolean;         // キャンバスがデプロイ済み状態と異なる場合に true
  isSaving: boolean;           // オートセーブ実行中に true
  // ... アクション
}
```

### オートセーブ

`nodes` または `edges` が変化するたびに、2 秒のデバウンスオートセーブが発火します：

```ts
// 2000ms デバウンス
useTopologyStore.getState().saveState(false)
```

現在の（非デプロイ）キャンバス状態を `POST /api/v1/topology/state?deployed=false` に保存します。

### `hasChanges` の計算

ラップされた `set` 関数によって、すべての状態更新時に自動で再計算されます。`checkHasChanges()` は以下の処理を行います：
1. ノードから `position`・`positionAbsolute`・`width`・`height`・`selected`・`dragging` を除去
2. ノードの `data` から `status` を除去
3. エッジから `selected` を除去
4. ソートされた JSON 文字列を比較

位置のみの変更は `hasChanges` を設定**しません** — 設定変更のみがトリガーになります。

---

### アクション

#### `addNode(type: 'router' | 'host' | 'switch')`

タイムスタンプベースのユニーク ID で新しいノードを作成し、次に使用可能なラベル文字（Router-A、Router-B…）を自動割り当てし、デフォルトデータを初期化して、カスケードオフセット位置に配置します。

#### `deleteNode(id: string)`

ノードと**接続されているすべてのエッジ**を状態から削除します。削除されたノードが選択中だった場合は `selectedNodeId` をクリアします。

#### `deleteEdge(id: string)`

エッジを削除し、両エンドポイントノードの対応するインターフェースの `connectedTo` フィールドをクリアします。

#### `updateNodeData(nodeId, data)`

`data` をノードの `data` フィールドにシャローマージします。PropertyPanel がフォームの変更を適用する際に広く使用されます。

#### `updateEdgeData(edgeId, data)`

`data` をエッジの `data` フィールドにシャローマージします。

#### `addPort(nodeId: string)`

ルーターまたはスイッチノードに新しいインターフェースを追加します。現在の最大 `eth{N}` 番号を見つけてインクリメントすることで自動命名します：
- Router：空の IP とネットマスクを持つ新しい `InterfaceData`
- Switch：`vlanMode: 'access'`、`vlanId: 1` の新しい `SwitchInterfaceData`

#### `deletePort(nodeId, portName)`

ノードから指定されたインターフェースを削除し、そのポートに接続されているエッジも削除します。

#### `onConnect(connection: Connection)`

ユーザーが新しい接続を描いた際に React Flow から呼ばれます。ハンドル ID から `-left-src`/`-right-tgt` サフィックスパターンを取り除いてインターフェース名を抽出し、`networkEdge` タイプのエッジを作成し、両エンドポイントノードの `connectedTo` を更新します。

#### `saveState(deployed?: boolean)`

`saveTopologyState()` を通じて `POST /api/v1/topology/state?deployed={deployed}` を呼び出します。`deployed === true` の場合、現在のノード/エッジのディープコピーを `deployedNodes`/`deployedEdges` に保存し、`hasChanges` をクリアします。

#### `loadState()`

ページ読み込み時（`App.tsx` が `useEffect` で呼び出し）：
1. `GET /topology/state?deployed=false` と `GET /topology/state?deployed=true` の両方を取得
2. `GET /topology/status` でどのコンテナが起動しているか確認
3. ランタイムステータスをノードデータにマージ（起動中のノードに `status: 'up'` を設定）
4. `hasChanges` を再計算
5. ストアを更新

#### `resetTopologyState()`

1. `DELETE /api/v1/topology/state` — バックエンドの永続化された状態をクリア
2. ハードコードされたデフォルトキャンバスを復元：ルーター 2 台 + ホスト 1 台（エッジ 1 本）
3. `deployedNodes`/`deployedEdges` をクリア

#### `setDeployedState(nodes, edges)`

指定された配列のディープコピーを `deployedNodes`/`deployedEdges` に保存します。正常なデプロイ後に `hasChanges` のベースラインを記録するために使用されます。

---

## `terminalStore.ts` — Zustand ストア

**場所：** `src/store/terminalStore.ts`

オープンなターミナルセッションのリストとアクティブなセッションを管理します。

### `TerminalSession` インターフェース

```ts
interface TerminalSession {
  nodeId: string;  // トポロジノード ID（terminalManager.activeRefs のキーでもある）
  label: string;   // タブに表示される名前（例：「Router-A」）
}
```

### 状態フィールド

```ts
sessions: TerminalSession[];    // すべてのオープンなターミナルタブ
activeSessionId: string | null; // 表示中のタブの nodeId
isExpanded: boolean;            // ターミナルパネルが展開モードかどうか
```

### アクション

| アクション | 動作 |
|---|---|
| `addSession(nodeId, label)` | セッションが既に存在する場合はアクティブにするだけ。存在しない場合は追加してアクティブに設定。 |
| `removeSession(nodeId)` | セッションを削除。アクティブだった場合は最後の残りセッションをアクティブにする（なければ `null`）。 |
| `setActiveSessionId(nodeId)` | 表示中のタブを切り替える。 |
| `setIsExpanded(expanded)` | 展開レイアウトをトグル。 |

> **注意：** `terminalStore` は**タブリストのみ**を管理します。実際の Xterm.js インスタンスと WebSocket 接続は React の状態外の `terminalManager.ts` が管理します。タブを閉じる（`removeSession`）際は、WebSocket のリークを防ぐために必ず `terminalManager` の `closeTerminalSession` と組み合わせてください。

---

## ナビゲーション

- [← 概要](./index.ja.md)
- [トポロジキャンバス →](./topology-canvas.ja.md)
- [パネル →](./panels.ja.md)
- [ターミナル →](./terminal.ja.md)
