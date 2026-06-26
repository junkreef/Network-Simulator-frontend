> 🇬🇧 English version available → [terminal.md](./terminal.md)

# ターミナルコンポーネント

このドキュメントでは `WebTerminal.tsx` と `terminalManager.ts` について説明します。

---

## アーキテクチャ概要

ターミナルサブシステムは 2 つのレイヤーに分かれています：

| レイヤー | ファイル | 責務 |
|---|---|---|
| **UI** | `WebTerminal.tsx` | タブバーとターミナルパネルの描画；ストアを通じたセッションライフサイクル管理 |
| **セッション** | `terminalManager.ts` | Xterm.js + WebSocket ペアの作成/破棄；モジュールレベルのシングルトンマップ |
| **状態** | `terminalStore.ts` | Zustand ストア — タブリスト・アクティブセッション ID・展開状態 |

---

## `terminalManager.ts`

**場所：** `src/components/terminal/terminalManager.ts`

モジュールレベルのマネージャーです（クラスでも React コンポーネントでもありません）。再レンダリングのたびにターミナルが再作成されないよう、ライブターミナルセッションのマップを React の状態の外側で管理します。

### `SessionRefs` インターフェース

```ts
interface SessionRefs {
  term: Terminal;                              // Xterm.js ターミナルインスタンス
  fitAddon: FitAddon;                          // 自動リサイズ用 Xterm.js アドオン
  ws: WebSocket;                               // ライブ WebSocket 接続
  onDataDisposable: { dispose: () => void };   // Xterm.js データハンドラーのクリーンアップ
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}
```

### 内部マップ

```ts
const activeRefs: Record<string, SessionRefs> = {};
const statusListeners: Record<string, ((status: SessionRefs['status']) => void)[]> = {};
```

`activeRefs` は `nodeId` をキーとします。`statusListeners` により React コンポーネントがポーリングなしで接続状態の変化を購読できます。

---

### `createTerminalSession(nodeId, label)`

新しいターミナルセッションを作成します。`nodeId` のセッションが既に存在する場合は即座にそのセッションを返します（冪等性あり）。

**手順：**

1. ダークテーマ（青カーソル、アプリのカラーパレットに合わせた配色）で `Terminal` をインスタンス化
2. `FitAddon` を作成してロード
3. WebSocket URL の決定：
   ```ts
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const host = import.meta.env.VITE_WS_HOST || `${window.location.hostname}:8000`;
   const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${nodeId}`;
   ```
4. 初期ステータスを `'connecting'` に設定し、接続中メッセージをターミナルに書き込む
5. WebSocket を開いてイベントハンドラーを登録

**WebSocket イベントハンドラー：**

| イベント | アクション |
|---|---|
| `onopen` | ステータスを `'connected'` に設定、`fitAddon.fit()` を呼び出し、`{ event: 'resize', cols, rows }` を送信 |
| `onmessage` | JSON をパース。`{ event: 'output', data }` の場合は `data` をターミナルに書き込む。JSON パース失敗時はそのまま書き込む |
| `onerror` | ステータスを `'error'` に設定し、エラーメッセージをターミナルに書き込む |
| `onclose` | ステータスを `'disconnected'` に設定し、切断メッセージをターミナルに書き込む |

**ターミナルデータハンドラー：**

```ts
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: 'input', data }));
  }
});
```

ターミナルからのすべてのキー入力は `{ event: 'input', data }` JSON にラップされてバックエンドに送信され、バックエンドがコンテナの stdin にパイプします。

---

### `closeTerminalSession(nodeId)`

WebSocket を閉じ、`onData` ハンドラーを解放し、`term.dispose()` を呼び出します。`activeRefs` からエントリを削除し、ステータスリスナーに `'disconnected'` を通知します。

### `resizeTerminalSession(nodeId)`

`fitAddon.fit()` でターミナルサイズを再計算し、WebSocket が開いている場合は `{ event: 'resize', cols, rows }` を送信します。これにより PTY のサイズが表示されているターミナルエリアと常に同期されます。

### `registerStatusListener(nodeId, listener)`

接続状態の更新にコールバックを購読します。購読解除関数を返します。セッションが既に存在する場合は、現在のステータスでリスナーが即座に呼び出されます。

---

## `WebTerminal.tsx`

**場所：** `src/components/terminal/WebTerminal.tsx`

トップレベルのターミナル UI コンポーネントです。画面下部に固定パネルを描画し、タブバーとオープンなセッションごとに 1 つのターミナルビューを表示します。

### ストア依存

```tsx
const { sessions, activeSessionId, isExpanded, removeSession, setActiveSessionId, setIsExpanded } = useTerminalStore();
const { nodes } = useTopologyStore();
```

### セッションの自動クリーンアップ

トポロジからノードが削除されると、そのターミナルセッションは自動的にクリーンアップされます：

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

### タブバー

`sessions` 内の各 `TerminalSession` にタブが表示されます。タブをクリックすると `setActiveSessionId(nodeId)` が呼ばれます。各タブの `X` ボタンは `closeTerminalSession` と `removeSession` を呼び出します。

右上隅の `connection-badge` はアクティブセッションの WebSocket 状態を表示します：`CONNECTED`、`CONNECTING`、`OFFLINE`、`ERROR`。

### 展開 / 折りたたみ

`terminalStore` の `isExpanded` フラグがターミナルパネルが画面を広く占有するかどうかを制御します。トグル時は DOM が落ち着いた後（100ms 遅延後）に `resizeTerminalSession` を呼び出してサイズを再計算します。

---

### `TerminalActiveView`（内部コンポーネント）

特定の `nodeId` に対して単一の Xterm.js ターミナルをマウントするプライベートコンポーネントです。

```tsx
function TerminalActiveView({ nodeId, label, isActive }: TerminalActiveViewProps)
```

- **初回マウント時**：`createTerminalSession(nodeId, label)` を呼び、`session.term.open(containerRef.current)` と `session.fitAddon.fit()` を実行
- **表示切り替え**：ラッパー `div` はアクティブ時は `display: block`、非アクティブ時は `display: none`。すべてのターミナル DOM 要素がバックグラウンドで生き続けるため、タブ切り替えで WebSocket の切断や再作成は発生しません
- **アクティブになった時**：50ms 後に `resizeTerminalSession(nodeId)` を実行
- **ResizeObserver**：親要素のサイズ変化を監視し、`resizeTerminalSession` を呼んで PTY サイズを同期

---

## フォーカス競合の問題

**問題**：Xterm.js はターミナル要素にフォーカスがある間、すべてのキーボード入力を捕捉するグローバル `keydown` リスナーを登録します。これにより `PropertyPanel` の `<input>` 要素がキーイベントを受け取れなくなることがあります。最も顕著なのは CIDR 表記（例：`192.168.1.0/24`）で使用される `/` 文字です。

**根本原因**：ターミナルと PropertyPanel の入力フィールドが同時に DOM に存在できます。ターミナルにフォーカスがある場合、入力フィールドより先にキーストロークを横取りします。

**対策**：PropertyPanel の入力フィールドがフォーカスを得た際にターミナル要素のフォーカスをプログラム的に外すか、非アクティブなタブのターミナルコンテナに `pointer-events: none` を設定してください。

サイドバーやターミナルエリア近くに新しい入力コンポーネントを追加する場合は、ターミナルパネルを開いた状態でテストし、すべての文字（特に `/`・`-`・数字）が意図した入力フィールドに正しく入力されることを確認してください。

---

## WebSocket メッセージプロトコル

フロントエンドとバックエンド間のすべてのメッセージは JSON エンコードされます：

| 方向 | メッセージ | 説明 |
|---|---|---|
| フロントエンド → バックエンド | `{ "event": "input", "data": "ls\r" }` | ターミナルからのキー入力 |
| フロントエンド → バックエンド | `{ "event": "resize", "cols": 120, "rows": 32 }` | ターミナルリサイズ |
| バックエンド → フロントエンド | `{ "event": "output", "data": "total 8\r\n..." }` | コンテナの stdout/stderr |

---

## ナビゲーション

- [← 概要](./index.ja.md)
- [トポロジキャンバス →](./topology-canvas.ja.md)
- [パネル →](./panels.ja.md)
- [状態管理 →](./state.ja.md)
