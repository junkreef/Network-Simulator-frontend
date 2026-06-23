import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Network, Laptop, Activity } from 'lucide-react';
import { RouterNodeData, HostNodeData } from '../../../types/topology';
import './CustomNodes.css';

export const RouterNode = ({ data, selected }: NodeProps<RouterNodeData>) => {
  const isUp = data.status === 'up';

  return (
    <div className={`custom-node router-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      {/* 4方向ハンドル */}
      <Handle type="source" position={Position.Top} id="eth0" className="node-handle" />
      <Handle type="source" position={Position.Right} id="eth1" className="node-handle" />
      <Handle type="source" position={Position.Bottom} id="eth2" className="node-handle" />
      <Handle type="source" position={Position.Left} id="eth3" className="node-handle" />

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
      <Handle type="source" position={Position.Top} id="eth0" className="node-handle" />

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
