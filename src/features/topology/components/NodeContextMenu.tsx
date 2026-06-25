import { useEffect, useRef } from 'react';
import { useTopologyStore } from '../../../store/topologyStore';
import { useTerminalStore } from '../../../store/terminalStore';
import { Terminal, Trash2 } from 'lucide-react';
import './NodeContextMenu.css';

interface NodeContextMenuProps {
  id: string;
  x: number;
  y: number;
  onClickOutside: () => void;
}

export default function NodeContextMenu({ id, x, y, onClickOutside }: NodeContextMenuProps) {
  const { nodes, deleteNode } = useTopologyStore();
  const { addSession } = useTerminalStore();
  const node = nodes.find(n => n.id === id);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClickOutside();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClickOutside]);

  if (!node) return null;

  const handleConnectTerminal = () => {
    if (node.data.status === 'up') {
      addSession(node.id, node.data.label);
    }
    onClickOutside();
  };

  const handleDeleteNode = () => {
    deleteNode(node.id);
    onClickOutside();
  };

  const isUp = node.data.status === 'up';

  return (
    <div 
      ref={menuRef} 
      className="node-context-menu" 
      style={{ top: y, left: x }}
      data-testid="node-context-menu"
    >
      <div className="menu-header">
        <span className="menu-title">{node.data.label}</span>
        <span className={`menu-status-badge ${node.data.status}`}>
          {node.data.status === 'up' ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div className="menu-divider" />
      <button 
        type="button" 
        className={`menu-item ${!isUp ? 'disabled' : ''}`}
        onClick={handleConnectTerminal}
        disabled={!isUp}
        title={!isUp ? 'ノードが起動していません' : 'ターミナルに接続します'}
      >
        <Terminal size={14} />
        <span>ターミナルに接続</span>
      </button>
      <button 
        type="button" 
        className="menu-item danger"
        onClick={handleDeleteNode}
      >
        <Trash2 size={14} />
        <span>ノードを削除</span>
      </button>
    </div>
  );
}
