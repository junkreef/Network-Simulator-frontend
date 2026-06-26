> 🇯🇵 日本語版はこちら → [../README.ja.md](../README.ja.md)

# Network Simulator — Frontend

Frontend for **Network Simulator** — a React + TypeScript application for topology editing and container terminal access.

The frontend provides an interactive canvas where developers can build network topologies visually, configure routing protocols (OSPF, RIP, BGP), and open real-time web terminals into running containers.

## Quick Start

```bash
npm install
npm run dev
```

The development server starts at **http://localhost:5173**.  
The backend must be running on **http://localhost:8000** (the Vite dev proxy forwards `/api` requests automatically).

## Tech Stack

| Tool | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Type-safe development |
| **Vite** | Build tool and dev server |
| **React Flow** | Interactive topology canvas |
| **Xterm.js** | Web terminal (WebSocket-based) |
| **Zustand** | Global state management |
| **Vitest** | Unit and integration tests |
| **Playwright** | End-to-end tests |

## Documentation

- **[Development Guide](./docs/development.md)** — setup, scripts, config, gotchas
- **[Component Guide](./docs/component-guide/index.md)** — source structure, component references, state management
