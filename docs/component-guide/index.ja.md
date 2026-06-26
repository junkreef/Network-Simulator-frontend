> 🇬🇧 English version available → [index.md](./index.md)

# コンポーネントガイド — ソースコード概要

このガイドでは `src/` ディレクトリ全体の構造と、主要コンポーネントの役割を説明します。

---

## `src/` ディレクトリツリー

```
src/
├── App.tsx               # ルートコンポーネント — ReactFlowProvider でラップし、マウント時に loadState を呼ぶ
├── main.tsx              # React エントリーポイント — App を #root にマウント
├── api/
│   └── client.ts         # 型付き HTTP クライアント（デプロイ・設定・状態・ランタイム情報の REST 呼び出し）
├── assets/               # 静的アセット（アイコン・画像）
├── components/           # 共有/レイアウトコンポーネント
│   ├── json/
│   │   └── JsonEditorModal.tsx  # トポロジ JSON の表示・インポート用モーダル
│   ├── layout/
│   │   └── Header.tsx    # トップナビゲーションバー — 適用・リセット・破棄ボタンと状態表示
│   ├── property/
│   │   └── PropertyPanel.tsx   # 右サイドバー — ノード/エッジの設定 UI（ルーティング・VLAN・IP など）
│   └── terminal/
│       ├── WebTerminal.tsx     # マルチタブ Xterm.js ターミナルパネル（WebSocket 接続）
│       └── terminalManager.ts  # ライブターミナルセッションと WebSocket 参照のモジュールレベルシングルトンマップ
├── features/
│   └── topology/         # トポロジ機能モジュール
│       ├── Canvas.tsx    # React Flow キャンバス — ノード/エッジ描画・イベント処理・ノード追加パレット
│       ├── Canvas.css
│       └── components/
│           ├── CustomNodes.tsx     # RouterNode・SwitchNode・HostNode — カスタム React Flow ノードレンダラー
│           ├── CustomNodes.css
│           ├── NetworkEdge.tsx     # カスタムエッジレンダラー（ベジェパス・ラベル・メトリクスバッジ）
│           ├── NetworkEdge.css
│           ├── NodeContextMenu.tsx # 右クリックコンテキストメニュー — ターミナル接続 / ノード削除
│           └── NodeContextMenu.css
├── store/
│   ├── topologyStore.ts  # Zustand ストア — トポロジ状態・アクション・オートセーブ・デプロイロジック
│   └── terminalStore.ts  # Zustand ストア — ターミナルセッションリスト・アクティブセッション・展開状態
├── styles/
│   └── global.css        # CSS カスタムプロパティ（カラーパレット・スペーシング）とベースリセット
└── types/
    └── topology.ts       # すべてのトポロジデータの TypeScript インターフェース（ノード・エッジ・ルーティング設定）
```

---

## ディレクトリの役割

### `api/`
薄い HTTP クライアントレイヤーです。すべての `fetch` 呼び出しは `client.ts` を経由し、`VITE_API_BASE_URL` 環境変数が一貫して適用されます。UI ロジックはここには含まれません。

### `components/`
特定の機能に依存しない再利用可能なコンポーネントやレイアウトコンポーネントです。ターミナルとプロパティパネルは、トポロジ機能とヘッダーをまたいで共有されるためここに配置されています。

### `features/topology/`
メインの機能モジュールです。`Canvas.tsx` が React Flow の主要ホストです。カスタムノード・エッジレンダラーは `components/` に配置されています。

### `store/`
すべてのグローバル状態です。`topologyStore.ts` はノード・エッジ・デプロイ状態・変更追跡の単一の情報源です。`terminalStore.ts` はタブリストとアクティブなターミナルセッションを管理します。

### `types/`
純粋な TypeScript 定義のみで、ランタイムコードはありません。ノードデータ・エッジデータ・ルーティングプロトコル設定のすべてのインターフェースがここにあります。インラインで型定義するのではなく、このモジュールからインポートしてください。

---

## データフロー概要

```
ユーザー操作（クリック・ドラッグ・接続・入力）
        │
        ▼
  Canvas.tsx / PropertyPanel.tsx
  (React Flow イベント → ストアアクション)
        │
        ▼
  topologyStore.ts  ←──── オートセーブ（2 秒デバウンス）
  (Zustand 状態)                │
        │                       ▼
        │               POST /api/v1/topology/state
        │
        ▼（適用ボタン押下時）
  Header.tsx → handleApply()
        │
        ├─ POST /api/v1/topology/deploy  （Containerlab）
        │
        └─ POST /api/v1/nodes/{id}/configure  （ノードごと並列実行）
                │
                ▼
          コンテナ内の FRR / bridge / ip コマンド
```

**ターミナルパス（トポロジとは独立）：**

```
ノード右クリック → NodeContextMenu → terminalStore.addSession(nodeId)
        │
        ▼
  WebTerminal.tsx が新しいタブを描画
        │
        ▼
  terminalManager.createTerminalSession(nodeId)
        │
        ├─ new Terminal() + FitAddon（Xterm.js）
        └─ new WebSocket(ws://host:8000/api/v1/ws/terminal/{nodeId})
              ↕ 双方向：キー入力 → バックエンド → コンテナの stdin/stdout
```

---

## ナビゲーション

- [← 開発ガイド](../development.ja.md)
- [トポロジキャンバス →](./topology-canvas.ja.md)
- [パネル（Header & PropertyPanel）→](./panels.ja.md)
- [ターミナル →](./terminal.ja.md)
- [状態管理 →](./state.ja.md)
