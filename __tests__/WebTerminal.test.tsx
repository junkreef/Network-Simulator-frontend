import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WebTerminal from '../src/components/terminal/WebTerminal';
import Canvas from '../src/features/topology/Canvas';
import { useTerminalStore } from '../src/store/terminalStore';
import { useTopologyStore } from '../src/store/topologyStore';
import { ReactFlowProvider } from 'reactflow';

// Mock WebSockets
class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }
  send = vi.fn();
  close = vi.fn();
}
vi.stubGlobal('WebSocket', MockWebSocket);

// ResizeObserver mock
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('WebTerminal and ContextMenu Integration', () => {
  beforeEach(() => {
    // Reset stores
    useTerminalStore.setState({
      sessions: [],
      activeSessionId: null,
      isExpanded: false
    });
    
    // Setup dummy nodes (one up and one down)
    useTopologyStore.setState({
      nodes: [
        {
          id: 'node-1',
          type: 'router',
          position: { x: 100, y: 100 },
          data: { label: 'Router-1', status: 'up', interfaces: [] }
        },
        {
          id: 'node-2',
          type: 'host',
          position: { x: 200, y: 200 },
          data: { label: 'Host-2', status: 'down', interfaces: [] }
        }
      ],
      selectedNodeId: null
    });
  });

  it('renders placeholder when no terminal sessions are active', () => {
    render(<WebTerminal />);
    expect(screen.getByTestId('terminal-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-status-badge')).not.toBeInTheDocument();
  });

  it('can open right click menu on node and add terminal session if node is up', async () => {
    render(
      <ReactFlowProvider>
        <Canvas />
        <WebTerminal />
      </ReactFlowProvider>
    );

    const node1 = screen.getByText('Router-1');
    expect(node1).toBeInTheDocument();

    // 右クリック (contextmenu イベント)
    fireEvent.contextMenu(node1);

    // コンテキストメニューが表示されることを確認
    const contextMenu = screen.getByTestId('node-context-menu');
    expect(contextMenu).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();

    // 「ターミナルに接続」ボタンをクリック
    const connectBtn = screen.getByText('ターミナルに接続').closest('button')!;
    fireEvent.click(connectBtn);

    // コンテキストメニューが閉じることを確認
    expect(screen.queryByTestId('node-context-menu')).not.toBeInTheDocument();

    // ターミナルのタブが表示され、プレースホルダーが消えることを確認
    expect(screen.getByTestId('terminal-tab-node-1')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-placeholder')).not.toBeInTheDocument();
  });

  it('disables "connect terminal" in right click menu if node is down', async () => {
    render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    );

    const node2 = screen.getByText('Host-2');
    fireEvent.contextMenu(node2);

    const connectBtn = screen.getByText('ターミナルに接続').closest('button')!;
    expect(connectBtn).toBeDisabled();
  });

  it('can manage multiple sessions and switch between them', () => {
    render(<WebTerminal />);

    // 2つのセッションを追加
    act(() => {
      useTerminalStore.getState().addSession('node-1', 'Router-1');
    });
    act(() => {
      useTerminalStore.getState().addSession('node-2', 'Host-2');
    });

    expect(screen.getByTestId('terminal-tab-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-tab-node-2')).toBeInTheDocument();

    // 現在の activeSessionId が node-2 であることを確認
    expect(useTerminalStore.getState().activeSessionId).toBe('node-2');
    expect(screen.getByTestId('terminal-tab-node-2')).toHaveClass('active');

    // タブクリックで node-1 に切り替える
    const tab1 = screen.getByTestId('terminal-tab-node-1');
    fireEvent.click(tab1);

    expect(useTerminalStore.getState().activeSessionId).toBe('node-1');
    expect(screen.getByTestId('terminal-tab-node-1')).toHaveClass('active');
  });

  it('can close a session and switch active session automatically', () => {
    render(<WebTerminal />);

    act(() => {
      useTerminalStore.getState().addSession('node-1', 'Router-1');
    });
    act(() => {
      useTerminalStore.getState().addSession('node-2', 'Host-2');
    });

    // node-2 (アクティブ) を閉じる
    const closeBtn2 = screen.getByTestId('terminal-close-node-2');
    fireEvent.click(closeBtn2);

    // セッション2が消え、セッション1がアクティブになる
    expect(screen.queryByTestId('terminal-tab-node-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-tab-node-1')).toBeInTheDocument();
    expect(useTerminalStore.getState().activeSessionId).toBe('node-1');
  });
});
