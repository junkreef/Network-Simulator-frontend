> 🇬🇧 English version available → [README.md](./README.md)

# Network Simulator — フロントエンド

**Network Simulator** のフロントエンド — トポロジー編集とコンテナ Web ターミナルのための React + TypeScript アプリケーション。

インタラクティブなキャンバスでネットワークトポロジーをビジュアルに構築し、ルーティングプロトコル（OSPF・RIP・BGP）を設定し、稼働中のコンテナへリアルタイムの Web ターミナルを開くことができます。

## クイックスタート

```bash
npm install
npm run dev
```

開発サーバーは **http://localhost:5173** で起動します。  
バックエンドが **http://localhost:8000** で起動している必要があります（Vite の dev プロキシが `/api` リクエストを自動転送します）。

## 技術スタック

| ツール | 用途 |
|---|---|
| **React 19** | UI フレームワーク |
| **TypeScript** | 型安全な開発 |
| **Vite** | ビルドツール・開発サーバー |
| **React Flow** | インタラクティブなトポロジーキャンバス |
| **Xterm.js** | Web ターミナル（WebSocket ベース） |
| **Zustand** | グローバル状態管理 |
| **Vitest** | ユニット・インテグレーションテスト |
| **Playwright** | エンドツーエンドテスト |

## ドキュメント

- **[開発ガイド](./docs/development.ja.md)** — セットアップ・スクリプト・設定・注意事項
- **[コンポーネントガイド](./docs/component-guide/index.ja.md)** — ソース構成・コンポーネント解説・状態管理
