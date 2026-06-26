> 🇯🇵 日本語版はこちら → [development.ja.md](./development.ja.md)

# Frontend Development Guide

This guide covers everything you need to develop, test, and build the Network Simulator frontend.

---

## Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** ≥ 9

---

## Setup

```bash
cd frontend
npm install
```

---

## Development Server

```bash
npm run dev
```

Starts the Vite dev server at **http://localhost:5173**.

The dev server proxies `/api/*` requests to `http://localhost:8000` (the FastAPI backend). The backend must be running for API-dependent features (deploy, runtime status, terminal) to work.

---

## Build

```bash
npm run build
```

Outputs to `dist/`. This runs `tsc -b` (TypeScript type-check) followed by `vite build`.

To preview the production build locally:

```bash
npm run preview
```

---

## Unit Tests (Vitest)

```bash
npm test
# or
npm run test
```

- Test files live in `__tests__/`
- Test environment: **jsdom** (configured in `vite.config.ts`)
- Setup file: `__tests__/setup.ts`
- Uses **@testing-library/react** for component rendering

**Coverage:**

```bash
npx vitest run --coverage
```

> Note: Coverage requires the `@vitest/coverage-v8` package: `npm install -D @vitest/coverage-v8`

---

## End-to-End Tests (Playwright)

```bash
npm run test:e2e
```

- Config: `playwright.config.ts`
- Test files: `e2e/`
- Results saved to: `test-results/`
- **Requires the backend to be running** at `http://localhost:8000` before executing

---

## TypeScript Configuration

Three `tsconfig` files are used:

| File | Purpose |
|---|---|
| `tsconfig.json` | Root config — references the two below |
| `tsconfig.app.json` | Config for `src/` (browser code). Strict mode, JSX, module resolution for React. |
| `tsconfig.node.json` | Config for Vite config file (`vite.config.ts`) — targets Node.js environment. |

---

## Linting (ESLint)

```bash
npm run lint
```

Config: `eslint.config.js`. Uses:
- `typescript-eslint` for TypeScript-aware rules
- `eslint-plugin-react-hooks` for hooks rules
- `eslint-plugin-react-refresh` for Vite fast-refresh compatibility

---

## Vite Configuration (`vite.config.ts`)

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

All requests beginning with `/api` are forwarded to the FastAPI backend during development. No CORS headers are needed in this setup.

The `test` section configures Vitest to use **jsdom** and a shared setup file.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Base URL for all REST API calls in `src/api/client.ts` |
| `VITE_WS_HOST` | `window.location.hostname:8000` | WebSocket host for terminal connections in `terminalManager.ts` |

Set these in a `.env.local` file at the `frontend/` root for local overrides:

```bash
VITE_API_BASE_URL=/api/v1
VITE_WS_HOST=localhost:8000
```

---

## Known Gotchas

### Xterm.js Focus Conflicts

Xterm.js captures **all** keyboard events when the terminal element is focused. This can interfere with `<input>` elements elsewhere in the UI — most notably when typing IP addresses (e.g., the `/` character in CIDR notation like `192.168.1.1/24`) in the PropertyPanel while the terminal panel is visible.

**Guideline**: When adding new input components near or within the same layout region as `WebTerminal`, ensure focus management is explicit. Do not rely on passive blur — actively prevent the terminal from stealing key events when your input is the intended target.

### WebSocket Terminal Validation

Do **not** validate terminal behavior by running `docker exec -it <container> sh` directly. The actual frontend path uses a WebSocket proxy through the FastAPI backend (`/api/v1/ws/terminal/{nodeId}`). The two paths are not equivalent — always test the terminal feature through the browser UI or via a WebSocket client pointed at the backend endpoint.

---

## Navigation

- [← README](../README.md)
- [Component Guide →](./component-guide/index.md)
