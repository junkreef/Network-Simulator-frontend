import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Network, Laptop, Activity } from 'lucide-react';
import type { RouterNodeData, HostNodeData } from '../../../types/topology';
import './CustomNodes.css';

export const RouterNode = ({ data, selected }: NodeProps<RouterNodeData>) => {
  const isUp = data.status === 'up';

  return (
    <div className={`custom-node router-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      {/* 4方向ハンドル (Source/Targetのペアを配置して双方向接続に対応) */}
      <Handle type="target" position={Position.Top} id="eth0-tgt" className="node-handle target-handle" style={{ transform: 'translateX(-4px)' }} />
      <Handle type="source" position={Position.Top} id="eth0-src" className="node-handle source-handle" style={{ transform: 'translateX(4px)' }} />
      
      <Handle type="target" position={Position.Right} id="eth1-tgt" className="node-handle target-handle" style={{ transform: 'translateY(-4px)' }} />
      <Handle type="source" position={Position.Right} id="eth1-src" className="node-handle source-handle" style={{ transform: 'translateY(4px)' }} />
      
      <Handle type="target" position={Position.Bottom} id="eth2-tgt" className="node-handle target-handle" style={{ transform: 'translateX(-4px)' }} />
      <Handle type="source" position={Position.Bottom} id="eth2-src" className="node-handle source-handle" style={{ transform: 'translateX(4px)' }} />
      
      <Handle type="target" position={Position.Left} id="eth3-tgt" className="node-handle target-handle" style={{ transform: 'translateY(-4px)' }} />
      <Handle type="source" position={Position.Left} id="eth3-src" className="node-handle source-handle" style={{ transform: 'translateY(4px)' }} />

      <div className="node-icon-wrapper">
        <Network size={24} className="node-icon" />
        <Activity size={10} className={`status-indicator ${isUp ? 'up' : 'down'}`} />
      </div>
      <div className="node-info">
        <span className="node-label">{data.label || 'Router'}</span>
        <span className="node-status-text">{isUp ? 'Running' : 'Offline'}</span>
      </div>
      
      {/* ポート番号のラベルを表示 */}
      <div className="handle-label label-top">eth0</div>
      <div className="handle-label label-right">eth1</div>
      <div className="handle-label label-bottom">eth2</div>
      <div className="handle-label label-left">eth3</div>
    </div>
  );
};

export const HostNode = ({ data, selected }: NodeProps<HostNodeData>) => {
  const isUp = data.status === 'up';

  return (
    <div className={`custom-node host-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      <Handle type="target" position={Position.Top} id="eth0-tgt" className="node-handle target-handle" style={{ transform: 'translateX(-4px)' }} />
      <Handle type="source" position={Position.Top} id="eth0-src" className="node-handle source-handle" style={{ transform: 'translateX(4px)' }} />

      <div className="node-icon-wrapper">
        <Laptop size={24} className="node-icon" />
        <Activity size={10} className={`status-indicator ${isUp ? 'up' : 'down'}`} />
      </div>
      <div className="node-info">
        <span className="node-label">{data.label || 'Host'}</span>
        <span className="node-status-text">{isUp ? 'Running' : 'Offline'}</span>
      </div>
      
      <div className="handle-label label-top">eth0</div>
    </div>
  );
};
