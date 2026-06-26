> 🇬🇧 English version available → [panels.md](./panels.md)

# パネル — Header と PropertyPanel

このドキュメントでは、トップバーの `Header` と右サイドバーの `PropertyPanel` について説明します。

---

## `Header.tsx`

**場所：** `src/components/layout/Header.tsx`

トップナビゲーションバーです。デプロイ・リセット・破棄など、トポロジレベルのすべてのアクションを担当します。

### ストア依存

```tsx
const { nodes, edges, hasChanges, saveState, resetTopologyState } = useTopologyStore();
```

### ボタン

#### 適用（Apply / Deploy）

メインのデプロイボタンです。`handleApply()` を実行します：

1. **デプロイペイロードの構築** — 現在のノードとエッジから `sim-network` トポロジオブジェクトを生成：
   ```json
   {
     "name": "sim-network",
     "nodes": [{ "name": "router-1", "type": "router", "interfaces": ["eth1","eth2"] }],
     "links": [{ "endpoints": ["router-1:eth1", "host-1:eth1"] }]
   }
   ```
2. **`POST /api/v1/topology/deploy`** — `applyTopology()` を通じて Containerlab にペイロードを送信。トポロジ構造に変更がない場合、バックエンドは `status: "skipped"` を返し、10 秒待機はスキップされます。
3. **10 秒待機**（スキップされた場合は除く）— コンテナが設定前にデーモンを初期化するのを待ちます。
4. **各ノードを並列設定** — すべてのノードに対して `POST /api/v1/nodes/{id}/configure` を `Promise.allSettled` で並列実行。ペイロードはノードタイプによって異なります：
   - **Router**：インターフェース（IP/マスク）、VLAN インターフェース、OSPF エリア、RIP ネットワーク、BGP ネイバー、スタティックルート
   - **Switch**：ポートごとの VLAN モード（access/trunk/none）と VLAN ID
   - **Host/Terminal**：eth1 の IP アドレスとデフォルトゲートウェイ
5. **ストアのノードステータスを `'up'` に更新**
6. **`saveState(true)`** — デプロイ済み状態をバックエンドに保存し、`hasChanges` インジケーターをクリア

#### 環境リセット

実行中のすべてのコンテナを停止・削除しますが、キャンバスの状態はリセットしません：

- `POST /api/v1/topology/destroy`
- ストア内のすべてのノードのステータスを `'down'` に更新

#### トポロジ初期化

コンテナを破棄し、かつキャンバスをデフォルト状態にリセットします：

- `POST /api/v1/topology/destroy`
- `resetTopologyState()` — `DELETE /api/v1/topology/state` を呼んでから、デフォルトのキャンバス（ルーター 2 台 + ホスト 1 台）を復元

#### JSON 編集

`JsonEditorModal` を開き、トポロジ JSON を直接編集・インポートできます。

### 状態インジケーター

- **未適用バッジ**（`hasChanges === true`）：現在のキャンバス状態が最後にデプロイされた状態と異なる場合に表示。ノード位置とランタイムステータスは比較から除外され、設定変更のみがこのバッジをトリガーします。
- **トースト通知**：各アクション後に成功/エラーメッセージが 4 秒間表示されます。

---

## `PropertyPanel.tsx`

**場所：** `src/components/property/PropertyPanel.tsx`

右サイドバーです。キャンバスで選択されているものに応じて異なるフォームを描画します。

何も選択されていない場合はプレースホルダーメッセージを表示します。ノードまたはエッジが選択されると、対応する設定 UI を描画します。

### 選択の取得

```tsx
const selectedNode = nodes.find(n => n.id === selectedNodeId);
const selectedEdge = edges.find(e => e.id === selectedEdgeId);
```

---

### ルーターパネル

`router` ノードが選択された場合に表示されます。2 つのタブがあります：

- **設定** — すべての設定フォーム
- **ステータス** — バックエンドから取得したランタイム情報

#### 設定タブのセクション

**インターフェース**

`data.interfaces` のリスト。各行には以下が表示されます：
- インターフェース名（例：`eth1`）
- IP/マスク入力 — `アドレス/プレフィックス` 形式を受け付け、`ipAddress` と `netmask` に分けて保存
- 管理状態トグル（UP ↔ DOWN）— `POST /api/v1/nodes/{id}/interfaces/{name}/state` を呼び出す

**VLAN サブインターフェース**

`data.vlanInterfaces` のリスト。各行で `vlanId` と `ipAddress`（CIDR）をインライン編集できます。下部のフォームから新しいサブインターフェースを追加できます（親ポートセレクター・VLAN ID・IP）。

**OSPF**

- 有効化トグル → `routing.ospf.enabled`
- ルーター ID → `routing.ospf.routerId`
- エリアリスト：各エリアには `areaId`、`interfaces[]`（利用可能なインターフェースから複数選択）、`areaType`、ルート集約用の `ranges[]` がある
- 再配送：connected / static / RIP / BGP チェックボックス
- Default-information originate：有効化 + `always` フラグ

**RIP**

- 有効化トグル → `routing.rip.enabled`
- ネットワークリスト（CIDR 文字列）
- 再配送：connected / static / OSPF / BGP チェックボックス

**BGP**

- 有効化トグル → `routing.bgp.enabled`
- AS 番号 → `routing.bgp.asNumber`
- ルーター ID → `routing.bgp.routerId`
- ネイバーリスト：IP + Remote-AS のペア
- 再配送：connected / static / OSPF / RIP チェックボックス

**スタティックルート**

`{ destination, nextHop }` のペアリスト。行を追加/削除できます。

#### ステータスタブ

`GET /api/v1/nodes/{id}/runtime-info?type={type}` でライブランタイムデータを取得します。

UI で選択可能なタイプ：
- `routing_table`（ルーティングテーブル）
- `arp`
- `ospf_neighbors`（OSPF ネイバー）
- `bgp_summary`（BGP サマリー）
- `rip_status`（RIP ステータス）

出力は等幅フォントのエリアにそのまま表示されます。

---

### スイッチパネル

`switch` ノードが選択された場合に表示されます。

**ポートごとの VLAN 設定**：`data.interfaces` の各インターフェースに対して：
- **VLAN モード**セレクター：`none` / `access` / `trunk`
- **Access VLAN ID**：数値入力（モードが `access` の場合に表示）
- **Trunk VLAN ID**：カンマ区切りの数値入力（モードが `trunk` の場合に表示）

変更はストアの `updateNodeData` に即時書き込まれ、次回のデプロイ時に適用されます。

---

### ホスト / ターミナルパネル

`host` ノードが選択された場合に表示されます。

- **IP アドレス**（CIDR）：`data.ipAddress`（例：`192.168.1.10/24`）
- **デフォルトゲートウェイ**：`data.gateway`（例：`192.168.1.1`）
- **eth1 の管理状態トグル**：`POST /api/v1/nodes/{id}/interfaces/eth1/state` を呼び出す

---

### エッジパネル

エッジが選択された場合に表示されます。

- **送信元ポート**と**送信先ポート**のラベル（読み取り専用：`data.sourceInterface` / `data.targetInterface`）
- **帯域幅**入力 — フリーテキスト（例：`100mbit`、`1gbit`）；`data.bandwidth` に保存
- **遅延**入力 — フリーテキスト（例：`10ms`）；`data.delay` に保存
- **OSPF コスト** — 数値；`data.cost` に保存
- **リンク状態トグル**（トポロジがデプロイ済みの場合に表示）：送信元ノードのインターフェースに `setInterfaceState` を呼び出してリンクを UP/DOWN に切り替え。エッジの `data.status` と対応するノードインターフェースの `adminState` を同期して更新します。
- **削除ボタン** — `deleteEdge(edgeId)` でエッジを削除

---

## ナビゲーション

- [← 概要](./index.ja.md)
- [トポロジキャンバス →](./topology-canvas.ja.md)
- [ターミナル →](./terminal.ja.md)
- [状態管理 →](./state.ja.md)
