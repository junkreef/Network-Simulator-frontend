import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Network, Laptop, Activity } from 'lucide-react';
import type { RouterNodeData, HostNodeData } from '../../../types/topology';
import './CustomNodes.css';

export const RouterNode = ({ data, selected }: NodeProps<RouterNodeData>) => {
  const isUp = data.status === 'up';

  return (
    <div className={`custom-node router-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      <div className="node-header">
        <div className="node-icon-wrapper">
          <Network size={20} className="node-icon" />
          <Activity size={8} className={`status-indicator ${isUp ? 'up' : 'down'}`} />
        </div>
        <div className="node-info">
          <span className="node-label">{data.label || 'Router'}</span>
          <span className="node-status-text">{isUp ? 'Running' : 'Offline'}</span>
        </div>
      </div>
      
      {/* ポートの動的リスト */}
      <div className="node-ports-list">
        {(data.interfaces || []).map((iface) => (
          <div key={iface.name} className="node-port-row">
            {/* 左側のハンドルペア (完全に重ねる) */}
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`${iface.name}-left-tgt`} 
              className="node-handle target-handle left" 
            />
            <Handle 
              type="source" 
              position={Position.Left} 
              id={`${iface.name}-left-src`} 
              className="node-handle source-handle left" 
            />

            <span className="port-name-label">{iface.name}</span>
            <span className="port-ip-label">{iface.ipAddress ? `${iface.ipAddress}/${iface.netmask}` : 'no IP'}</span>

            {/* 右側のハンドルペア (完全に重ねる) */}
            <Handle 
              type="target" 
              position={Position.Right} 
              id={`${iface.name}-right-tgt`} 
              className="node-handle target-handle right" 
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`${iface.name}-right-src`} 
              className="node-handle source-handle right" 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const HostNode = ({ data, selected }: NodeProps<HostNodeData>) => {
  const isUp = data.status === 'up';

  return (
    <div className={`custom-node host-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      <div className="node-header">
        <div className="node-icon-wrapper">
          <Laptop size={20} className="node-icon" />
          <Activity size={8} className={`status-indicator ${isUp ? 'up' : 'down'}`} />
        </div>
        <div className="node-info">
          <span className="node-label">{data.label || 'Host'}</span>
          <span className="node-status-text">{isUp ? 'Running' : 'Offline'}</span>
        </div>
      </div>
      
      <div className="node-ports-list">
        <div className="node-port-row">
          {/* 左側のハンドルペア (完全に重ねる) */}
          <Handle 
            type="target" 
            position={Position.Left} 
            id="eth0-left-tgt" 
            className="node-handle target-handle left" 
          />
          <Handle 
            type="source" 
            position={Position.Left} 
            id="eth0-left-src" 
            className="node-handle source-handle left" 
          />

          <span className="port-name-label">eth0</span>
          <span className="port-ip-label">{data.ipAddress || 'no IP'}</span>

          {/* 右側のハンドルペア (完全に重ねる) */}
          <Handle 
            type="target" 
            position={Position.Right} 
            id="eth0-right-tgt" 
            className="node-handle target-handle right" 
          />
          <Handle 
            type="source" 
            position={Position.Right} 
            id="eth0-right-src" 
            className="node-handle source-handle right" 
          />
        </div>
      </div>
    </div>
  );
};
