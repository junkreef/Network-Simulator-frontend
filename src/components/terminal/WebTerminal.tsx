import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTopologyStore } from '../../store/topologyStore';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import './WebTerminal.css';

export default function WebTerminal() {
  const { nodes, selectedNodeId } = useTopologyStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  useEffect(() => {
    // 選択されたノードがない、またはノードがDOWN状態の場合は接続しない
    if (!selectedNodeId || !selectedNode || selectedNode.data.status !== 'up') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.write('\r\nNode is offline or not selected. Select a running node to connect terminal.\r\n');
      }
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    // 1. Xterm.js のセットアップ (マウントは1回だけ、またはコンテナが存在する場合)
    if (!xtermRef.current && containerRef.current) {
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

      term.open(containerRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
    } else if (xtermRef.current && fitAddonRef.current) {
      xtermRef.current.clear();
      fitAddonRef.current.fit();
    }

    const term = xtermRef.current;
    if (!term) return;

    term.write(`\r\nConnecting to terminal of ${selectedNode.data.label}...\r\n`);

    // 2. WebSocket 接続
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || `${window.location.hostname}:8000`;
    const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${selectedNodeId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // データリスナー
    const onTermData = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'input', data }));
      }
    });

    ws.onopen = () => {
      setConnectionStatus('connected');
      term.write('\r\nConnection established.\r\n');
      
      // 初回リサイズ同期
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = term;
        ws.send(JSON.stringify({ event: 'resize', cols, rows }));
      }
    };

    ws.onmessage = (event) => {
      const msg = event.data;
      // バックエンドから送られてくる生出力をターミナルへ書き込む
      // もし JSON 形式である可能性がある場合はパースを試みる
      try {
        const parsed = JSON.parse(msg);
        if (parsed.event === 'output' && parsed.data) {
          term.write(parsed.data);
        } else {
          // JSONだが別イベントの場合
          term.write(msg);
        }
      } catch (e) {
        // 生のテキストデータの場合
        term.write(msg);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      term.write('\r\nWebSocket connection error.\r\n');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      term.write('\r\nConnection closed.\r\n');
    };

    // 3. ResizeObserver によるリサイズ検知
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && term) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = term;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'resize', cols, rows }));
          }
        } catch (err) {
          console.warn('Xterm fit failure', err);
        }
      }
    });

    if (containerRef.current && containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    // クリーンアップ
    return () => {
      onTermData.dispose();
      resizeObserver.disconnect();
      if (ws) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [selectedNodeId, selectedNode?.data.status]);

  return (
    <div className={`web-terminal-container ${isExpanded ? 'expanded' : ''}`} data-testid="web-terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <TerminalIcon size={16} className="terminal-header-icon" />
          <span>ターミナル: {selectedNode ? selectedNode.data.label : '未選択'}</span>
          <span className={`connection-badge ${connectionStatus}`}>
            {connectionStatus === 'connected' && 'CONNECTED'}
            {connectionStatus === 'connecting' && 'CONNECTING'}
            {connectionStatus === 'disconnected' && 'OFFLINE'}
            {connectionStatus === 'error' && 'ERROR'}
          </span>
        </div>
        <div className="terminal-actions">
          <button 
            type="button" 
            className="action-btn"
            onClick={() => {
              setIsExpanded(!isExpanded);
              // サイズ変更に合わせて Xterm.js の再フィットを走らせる
              setTimeout(() => {
                if (fitAddonRef.current && xtermRef.current) {
                  fitAddonRef.current.fit();
                  const { cols, rows } = xtermRef.current;
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ event: 'resize', cols, rows }));
                  }
                }
              }, 100);
            }}
            title={isExpanded ? '縮小' : '最大化'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      <div className="terminal-body">
        <div ref={containerRef} className="xterm-dom-element" data-testid="terminal-container" />
      </div>
    </div>
  );
}
