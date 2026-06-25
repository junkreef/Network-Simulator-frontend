import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

export interface SessionRefs {
  term: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket;
  onDataDisposable: { dispose: () => void };
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const activeRefs: Record<string, SessionRefs> = {};
const statusListeners: Record<string, ((status: SessionRefs['status']) => void)[]> = {};

export function registerStatusListener(nodeId: string, listener: (status: SessionRefs['status']) => void) {
  if (!statusListeners[nodeId]) {
    statusListeners[nodeId] = [];
  }
  statusListeners[nodeId].push(listener);
  
  // 現在の状態があれば即座に通知
  if (activeRefs[nodeId]) {
    listener(activeRefs[nodeId].status);
  } else {
    listener('disconnected');
  }

  return () => {
    statusListeners[nodeId] = statusListeners[nodeId].filter(l => l !== listener);
  };
}

function updateStatus(nodeId: string, status: SessionRefs['status']) {
  if (activeRefs[nodeId]) {
    activeRefs[nodeId].status = status;
  }
  if (statusListeners[nodeId]) {
    statusListeners[nodeId].forEach(listener => listener(status));
  }
}

export function createTerminalSession(nodeId: string, label: string) {
  if (activeRefs[nodeId]) {
    return activeRefs[nodeId];
  }

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'JetBrains Mono, Courier New, monospace',
    theme: {
      background: '#0b0f19',
      foreground: '#f3f4f6',
      cursor: '#3b82f6',
      black: '#161b26',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#8b5cf6',
      cyan: '#06b6d4',
      white: '#f3f4f6',
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || `${window.location.hostname}:8000`;
  const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${nodeId}`;

  updateStatus(nodeId, 'connecting');
  term.write(`\r\nConnecting to terminal of ${label}...\r\n`);

  const ws = new WebSocket(wsUrl);

  const onDataDisposable = term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'input', data }));
    }
  });

  ws.onopen = () => {
    updateStatus(nodeId, 'connected');
    term.write('\r\nConnection established.\r\n');
    try {
      fitAddon.fit();
      const { cols, rows } = term;
      ws.send(JSON.stringify({ event: 'resize', cols, rows }));
    } catch (e) {
      console.warn('Xterm fit failure on open', e);
    }
  };

  ws.onmessage = (event) => {
    const msg = event.data;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.event === 'output' && parsed.data) {
        term.write(parsed.data);
      } else {
        term.write(msg);
      }
    } catch (e) {
      term.write(msg);
    }
  };

  ws.onerror = () => {
    updateStatus(nodeId, 'error');
    term.write('\r\nWebSocket connection error.\r\n');
  };

  ws.onclose = () => {
    updateStatus(nodeId, 'disconnected');
    term.write('\r\nConnection closed.\r\n');
  };

  activeRefs[nodeId] = {
    term,
    fitAddon,
    ws,
    onDataDisposable,
    status: 'connecting',
  };

  return activeRefs[nodeId];
}

export function getTerminalSession(nodeId: string): SessionRefs | undefined {
  return activeRefs[nodeId];
}

export function closeTerminalSession(nodeId: string) {
  const refs = activeRefs[nodeId];
  if (refs) {
    try {
      refs.ws.close();
    } catch (e) {
      // Ignored
    }
    refs.onDataDisposable.dispose();
    refs.term.dispose();
    delete activeRefs[nodeId];
    updateStatus(nodeId, 'disconnected');
  }
}

export function resizeTerminalSession(nodeId: string) {
  const refs = activeRefs[nodeId];
  if (refs) {
    try {
      refs.fitAddon.fit();
      const { cols, rows } = refs.term;
      if (refs.ws.readyState === WebSocket.OPEN) {
        refs.ws.send(JSON.stringify({ event: 'resize', cols, rows }));
      }
    } catch (err) {
      console.warn('Xterm fit failure', err);
    }
  }
}
