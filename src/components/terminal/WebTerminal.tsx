import { useEffect, useRef, useState } from 'react';
import { useTerminalStore } from '../../store/terminalStore';
import { useTopologyStore } from '../../store/topologyStore';
import { Terminal as TerminalIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { 
  createTerminalSession, 
  closeTerminalSession, 
  resizeTerminalSession,
  registerStatusListener
} from './terminalManager';
import type { SessionRefs } from './terminalManager';
import 'xterm/css/xterm.css';
import './WebTerminal.css';


interface TerminalActiveViewProps {
  nodeId: string;
  label: string;
  isActive: boolean;
}

// 個別のターミナルセッションをマウントするコンポーネント
function TerminalActiveView({ nodeId, label, isActive }: TerminalActiveViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // 最初のマウント時にセッションを作成＆マウント
    if (!mountedRef.current && containerRef.current) {
      const session = createTerminalSession(nodeId, label);
      session.term.open(containerRef.current);
      session.fitAddon.fit();
      mountedRef.current = true;
    }
  }, [nodeId, label]);

  // アクティブになったらリサイズする
  useEffect(() => {
    if (isActive && mountedRef.current) {
      // DOMのレンダリングを待つために少し遅延させる
      const timer = setTimeout(() => {
        resizeTerminalSession(nodeId);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, nodeId]);

  // ResizeObserver による表示エリアの変化検知
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (isActive && mountedRef.current) {
        try {
          resizeTerminalSession(nodeId);
        } catch (err) {
          console.warn('Xterm fit failure', err);
        }
      }
    });

    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isActive, nodeId]);

  return (
    <div 
      className="terminal-view-wrapper" 
      style={{ display: isActive ? 'block' : 'none', height: '100%', width: '100%' }}
    >
      <div ref={containerRef} className="xterm-dom-element" data-testid={`terminal-container-${nodeId}`} />
    </div>
  );
}

export default function WebTerminal() {
  const { sessions, activeSessionId, isExpanded, removeSession, setActiveSessionId, setIsExpanded } = useTerminalStore();
  const { nodes } = useTopologyStore();

  // 存在しなくなったノードのセッションを自動クリーンアップ
  useEffect(() => {
    sessions.forEach((session) => {
      const exists = nodes.some((n) => n.id === session.nodeId);
      if (!exists) {
        closeTerminalSession(session.nodeId);
        removeSession(session.nodeId);
      }
    });
  }, [nodes, sessions, removeSession]);

  // 現在アクティブなノードのリサイズ用ウィンドウイベント
  useEffect(() => {
    if (activeSessionId) {
      const handleResize = () => {
        resizeTerminalSession(activeSessionId);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [activeSessionId]);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    setTimeout(() => {
      if (activeSessionId) {
        resizeTerminalSession(activeSessionId);
      }
    }, 100);
  };

  const handleCloseSession = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    closeTerminalSession(nodeId);
    removeSession(nodeId);
  };

  // アクティブなセッションのstatusを監視するためのバッジ表示用
  const [activeStatus, setActiveStatus] = useState<SessionRefs['status']>('disconnected');
  useEffect(() => {
    if (!activeSessionId) {
      setActiveStatus('disconnected');
      return;
    }
    return registerStatusListener(activeSessionId, (status) => {
      setActiveStatus(status);
    });
  }, [activeSessionId]);

  return (
    <div className={`web-terminal-container ${isExpanded ? 'expanded' : ''}`} data-testid="web-terminal">
      <div className="terminal-header">
        <div className="terminal-tabs">
          {sessions.map((session) => (
            <div 
              key={session.nodeId}
              className={`terminal-tab-item ${session.nodeId === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.nodeId)}
              data-testid={`terminal-tab-${session.nodeId}`}
            >
              <TerminalIcon size={12} className="tab-icon" />
              <span className="tab-label">{session.label}</span>
              <button 
                type="button" 
                className="tab-close-btn"
                onClick={(e) => handleCloseSession(e, session.nodeId)}
                data-testid={`terminal-close-${session.nodeId}`}
                title="セッションを閉じる"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="terminal-title">
              <TerminalIcon size={16} className="terminal-header-icon" />
              <span>ターミナル (接続なし)</span>
            </div>
          )}
        </div>
        <div className="terminal-actions">
          {activeSessionId && (
            <span className={`connection-badge ${activeStatus}`} data-testid="terminal-status-badge">
              {activeStatus === 'connected' && 'CONNECTED'}
              {activeStatus === 'connecting' && 'CONNECTING'}
              {activeStatus === 'disconnected' && 'OFFLINE'}
              {activeStatus === 'error' && 'ERROR'}
            </span>
          )}
          {sessions.length > 0 && (
            <button 
              type="button" 
              className="action-btn"
              onClick={handleToggleExpand}
              title={isExpanded ? '縮小' : '最大化'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className="terminal-body">
        {sessions.map((session) => (
          <TerminalActiveView 
            key={session.nodeId}
            nodeId={session.nodeId}
            label={session.label}
            isActive={session.nodeId === activeSessionId}
          />
        ))}
        {sessions.length === 0 && (
          <div className="terminal-placeholder" data-testid="terminal-placeholder">
            ノードを右クリックして「ターミナルに接続」を選択すると、セッションを開始できます。
          </div>
        )}
      </div>
    </div>
  );
}
