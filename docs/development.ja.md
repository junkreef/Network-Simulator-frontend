> 🇬🇧 English version available → [development.md](./development.md)

# フロントエンド開発ガイド

このガイドでは、Network Simulator フロントエンドの開発・テスト・ビルドに必要な情報を説明します。

---

## 前提条件

- **Node.js** ≥ 18（LTS 推奨）
- **npm** ≥ 9

---

## セットアップ

```bash
cd frontend
npm install
```

---

## 開発サーバー

```bash
npm run dev
```

Vite 開発サーバーが **http://localhost:5173** で起動します。

開発サーバーは `/api/*` へのリクエストを `http://localhost:8000`（FastAPI バックエンド）にプロキシします。デプロイ・ランタイムステータス・ターミナルなどの機能を使うには、バックエンドが起動している必要があります。

---

## ビルド

```bash
npm run build
```

ビルド成果物は `dist/` に出力されます。内部では `tsc -b`（型チェック）を実行してから `vite build` を実行します。

本番ビルドをローカルでプレビューするには：

```bash
npm run preview
```

---

## ユニットテスト（Vitest）

```bash
npm test
# または
npm run test
```

- テストファイルは `__tests__/` に配置
- テスト環境：**jsdom**（`vite.config.ts` で設定）
- セットアップファイル：`__tests__/setup.ts`
- コンポーネントレンダリングには **@testing-library/react** を使用

**カバレッジ取得：**

```bash
npx vitest run --coverage
```

> Note: カバレッジの取得には `@vitest/coverage-v8` パッケージが必要です：`npm install -D @vitest/coverage-v8`

---

## E2E テスト（Playwright）

```bash
npm run test:e2e
```

- 設定ファイル：`playwright.config.ts`
- テストファイル：`e2e/`
- 結果の保存先：`test-results/`
- **実行前にバックエンド（`http://localhost:8000`）が起動している必要があります**

---

## TypeScript 設定

3 つの `tsconfig` ファイルが存在します：

| ファイル | 用途 |
|---|---|
| `tsconfig.json` | ルート設定。以下 2 つを参照する |
| `tsconfig.app.json` | `src/` 配下のブラウザコード用。Strict モード、JSX、React 向けモジュール解決 |
| `tsconfig.node.json` | Vite 設定ファイル（`vite.config.ts`）用。Node.js 環境向け |

---

## リント（ESLint）

```bash
npm run lint
```

設定ファイル：`eslint.config.js`。以下を使用：
- `typescript-eslint`：TypeScript 対応ルール
- `eslint-plugin-react-hooks`：フックのルール
- `eslint-plugin-react-refresh`：Vite Fast Refresh 互換性

---

## Vite 設定（`vite.config.ts`）

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

開発中、`/api` で始まるリクエストはすべて FastAPI バックエンドに転送されます。この設定により CORS ヘッダーは不要です。

`test` セクションでは Vitest が **jsdom** を使用し、共通セットアップファイルを読み込む設定になっています。

---

## 環境変数

| 変数名 | デフォルト値 | 説明 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | `src/api/client.ts` における REST API のベース URL |
| `VITE_WS_HOST` | `window.location.hostname:8000` | `terminalManager.ts` のターミナル WebSocket 接続先ホスト |

`frontend/` ディレクトリ直下の `.env.local` にローカル設定を記述できます：

```bash
VITE_API_BASE_URL=/api/v1
VITE_WS_HOST=localhost:8000
```

---

## 既知の注意点

### Xterm.js のフォーカス競合

Xterm.js はターミナル要素にフォーカスがある間、**すべての**キーボードイベントを横取りします。これにより、PropertyPanel の IP アドレス入力（例：CIDR 表記の `/`）など、UI 内の `<input>` 要素が正常に動作しなくなることがあります。

**指針**：`WebTerminal` と同じレイアウト領域に新しい入力コンポーネントを追加する際は、フォーカス管理を明示的に行ってください。パッシブなブラーに頼らず、自分の入力が意図されたターゲットである場合にターミナルがキーイベントを奪わないよう、積極的に防止してください。

### WebSocket ターミナルの検証

`docker exec -it <container> sh` を直接実行してターミナルの動作を検証しないでください。フロントエンドの実際のパスは FastAPI バックエンドを経由した WebSocket プロキシ（`/api/v1/ws/terminal/{nodeId}`）です。両者のパスは等価ではありません。ターミナル機能のテストは必ずブラウザ UI か、バックエンドエンドポイントを対象にした WebSocket クライアントを使って行ってください。

---

## ナビゲーション

- [← README](../README.md)
- [コンポーネントガイド →](./component-guide/index.md)
