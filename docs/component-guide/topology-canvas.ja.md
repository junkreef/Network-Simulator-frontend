> 🇬🇧 English version available → [topology-canvas.md](./topology-canvas.md)

# トポロジキャンバスコンポーネント

このドキュメントでは `Canvas.tsx`、3 つのカスタムノードコンポーネント、`NetworkEdge.tsx`、`NodeContextMenu.tsx` について説明します。

---

## `Canvas.tsx`

**場所：** `src/features/topology/Canvas.tsx`

React Flow キャンバスのルートコンポーネントです。すべてのノード/エッジ描画・ユーザーインタラクションイベント・フローティングノードパレットを統合します。

### 状態とストア

`Canvas` はコンテキストメニューの位置以外はステートレスです。すべてのトポロジ状態は `topologyStore` から取得します：

```tsx
const {
  nodes, edges,
  onNodesChange, onEdgesChange, onConnect,
  selectNode, selectEdge, addNode,
} = useTopologyStore();
```

コンテキストメニュー用のローカル状態：

```tsx
const [contextMenu, setContextMenu] = useState<{
  id: string; x: number; y: number;
} | null>(null);
```

### ノードタイプの登録

カスタムノードタイプは `useMemo` でメモ化され、レンダリングのたびに React Flow が再登録するのを防ぎます：

```tsx
const nodeTypes = useMemo<NodeTypes>(() => ({
  router: RouterNode,
  host:   HostNode,
  switch: SwitchNode,
}), []);
```

### エッジタイプの登録

```tsx
const edgeTypes = useMemo<EdgeTypes>(() => ({
  networkEdge: NetworkEdge,
}), []);
```

ストア内のすべてのエッジは `type: 'networkEdge'` で作成されるため、常にこのレンダラーが使われます。

### 主要なイベントハンドラー

| ハンドラー | トリガー | アクション |
|---|---|---|
| `onNodesChange` | ノードのドラッグ・選択・削除 | ストアから React Flow にそのまま渡す |
| `onEdgesChange` | エッジの選択・削除 | ストアから React Flow にそのまま渡す |
| `onConnect` | ユーザーが 2 つのハンドル間に接続を描く | ストアがハンドル ID からインターフェース名を抽出して新しいエッジを作成 |
| `onNodeClick` | ノードをクリック | `selectNode(node.id)`、コンテキストメニューを閉じる |
| `onEdgeClick` | エッジをクリック | `selectEdge(edge.id)`、コンテキストメニューを閉じる |
| `onNodeContextMenu` | ノードを右クリック | `.react-flow` バウンディングボックス相対のクリック位置を記録し、`NodeContextMenu` を表示 |
| `onPaneClick` | キャンバスの空白をクリック | 選択とコンテキストメニューをクリア |

### コンテキストメニューの位置計算

```tsx
const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
setContextMenu({
  id: node.id,
  x: event.clientX - pane.left,
  y: event.clientY - pane.top,
});
```

座標はキャンバス相対で計算されるため、メニューはキャンバスコンテナ内に正しく表示されます。

### キャンバスの装飾

- **Background**：ドットグリッドパターン（16px 間隔、薄い白のドット）
- **Controls**：ズーム/フィットコントロール（インタラクティブトグルは非表示）
- **MiniMap**：ノードタイプ別に色分け — ルーター=青、スイッチ=シアン、ホスト=緑

### フローティングノードパレット

キャンバス下部のツールバーにノード追加ボタンがあります：

```tsx
<button onClick={() => addNode('router')}>+ ルーター追加</button>
<button onClick={() => addNode('switch')}>+ スイッチ追加</button>
<button onClick={() => addNode('host')}>+ ホスト追加</button>
```

ストアの `addNode(type)` はユニークな ID を生成し、ラベルを自動命名（例：`Router-C`）し、既存ノードからオフセットした位置に配置します。

---

## `CustomNodes.tsx`

**場所：** `src/features/topology/components/CustomNodes.tsx`

3 つの React Flow ノードレンダラーをエクスポートします。各コンポーネントは React Flow の `NodeProps<T>` から `{ id, data, selected }` を受け取ります。

### ハンドルの命名規則

各ポートには**4 つ**の `Handle` コンポーネントがあります — 左右それぞれにソースハンドルとターゲットハンドルが 1 つずつ：

```
Handle ID パターン: `${portName}-${left|right}-${src|tgt}`

例：
  eth1-left-src   （eth1 の左側のソースハンドル）
  eth1-left-tgt   （eth1 の左側のターゲットハンドル）
  eth1-right-src  （eth1 の右側のソースハンドル）
  eth1-right-tgt  （eth1 の右側のターゲットハンドル）
```

ソースハンドルとターゲットハンドルは同じ位置に重ねて配置されます。これにより、ユーザーがソースとターゲットを区別せずにどちらの方向にも接続できます。

ポートが接続済み（`isConnected === true`）になると、そのポートのすべてのハンドルは接続不可になります：

```tsx
isConnectable={!isConnected}
```

接続検出には `checkIsPortConnected()` を使用し、`edge.data.sourceInterface`、`edge.data.targetInterface`、および `sourceHandle`/`targetHandle` の文字列プレフィックスとポート名を照合します。

---

### `RouterNode`

- **アイコン**：`Network`（lucide-react）
- **ステータスインジケーター**：`Activity` アイコン（`.up` または `.down` でスタイル）
- **ポートリスト**：`data.interfaces` をイテレートし、インターフェースごとにポート行を描画
- **VLAN サブインターフェース**：親ポートの下にインデントされたサブ行として表示（`.{vlanId}` と IP アドレスを表示）
- **IP 表示**：`{ipAddress}/{netmask}`、未設定の場合は `no IP`

### `HostNode`

- **アイコン**：`Laptop`（lucide-react）
- **単一ポート**：常に `eth1`。IP アドレスは `data.ipAddress` から表示
- **VLAN サブインターフェース**：RouterNode と同様（`parentInterface === 'eth1'` でフィルタ）

### `SwitchNode`

- **アイコン**：`Network`（lucide-react）
- **ポートリスト**：`data.interfaces` をイテレート
- **VLAN ラベル**：現在のモードを表示
  - Access：`VLAN {vlanId}`
  - Trunk：`Trunk (10,20,...)` または ID が未設定の場合 `Trunk (all)`
  - None：`no VLAN`

---

## `NetworkEdge.tsx`

**場所：** `src/features/topology/components/NetworkEdge.tsx`

インラインラベルを持つベジェ曲線を使用するカスタム React Flow エッジレンダラーです。

### パスの描画

```tsx
const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
```

SVG `<path>` は状態に応じて CSS クラスを受け取ります：
- `selected` — エッジがクリック/選択された場合
- `dashed` — メトリクス（bandwidth/delay/cost）が未設定の場合
- `down` — `data.status === 'down'` の場合

### ラベルの描画

`EdgeLabelRenderer` はキャンバス座標空間の `(labelX, labelY)` に React DOM 要素を配置します。ラベルには以下が表示されます：

```
[sourceInterface] - [targetInterface]
         例：   eth1 - eth2
```

### メトリクスバッジ

`bandwidth`、`delay`、`cost` のいずれかがエッジに設定されている場合、ポートラベルの下にバッジが表示されます：

```
100mbit  |  10ms  |  Cost: 5
```

---

## `NodeContextMenu.tsx`

**場所：** `src/features/topology/components/NodeContextMenu.tsx`

`onNodeContextMenu` で記録された座標に絶対配置されるフローティングコンテキストメニューです。

### Props

```ts
interface NodeContextMenuProps {
  id: string;            // ノード ID
  x: number;            // キャンバス相対 X 座標
  y: number;            // キャンバス相対 Y 座標
  onClickOutside: () => void;
}
```

### 閉じる動作

`document` の `mousedown` リスナーが `menuRef` の外側をクリックするとメニューを閉じます。このリスナーは `useEffect` で設定され、アンマウント時にクリーンアップされます。

### メニュー項目

| 項目 | 条件 | アクション |
|---|---|---|
| **ターミナルに接続** | `node.data.status === 'up'` の場合のみ有効 | `terminalStore.addSession(nodeId, label)` を呼んで新しいターミナルタブを開く |
| **ノードを削除** | 常に利用可能 | `topologyStore.deleteNode(id)` を呼んでノードと接続エッジを削除 |

ヘッダーセクションにはノードラベルと `ONLINE`/`OFFLINE` バッジが表示されます。

---

## ナビゲーション

- [← 概要](./index.ja.md)
- [パネル →](./panels.ja.md)
- [ターミナル →](./terminal.ja.md)
- [状態管理 →](./state.ja.md)
