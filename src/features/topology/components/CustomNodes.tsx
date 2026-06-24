import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Network, Laptop, Activity } from 'lucide-react';
import type { RouterNodeData, HostNodeData, SwitchNodeData } from '../../../types/topology';
import { useTopologyStore } from '../../../store/topologyStore';
import './CustomNodes.css';

const checkIsPortConnected = (nodeId: string, portName: string, edges: any[]) => {
  return edges.some(edge => 
    (edge.source === nodeId && (edge.data?.sourceInterface === portName || (edge.sourceHandle && edge.sourceHandle.startsWith(`${portName}-`)))) ||
    (edge.target === nodeId && (edge.data?.targetInterface === portName || (edge.targetHandle && edge.targetHandle.startsWith(`${portName}-`))))
  );
};

export const RouterNode = ({ id, data, selected }: NodeProps<RouterNodeData>) => {
  const isUp = data.status === 'up';
  const edges = useTopologyStore(state => state.edges);

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
        {(data.interfaces || []).map((iface) => {
          const isConnected = checkIsPortConnected(id, iface.name, edges);
          return (
            <div key={iface.name} className="node-port-row" data-connected={isConnected}>
              {/* 左側のハンドルペア (完全に重ねる) */}
              <Handle 
                type="target" 
                position={Position.Left} 
                id={`${iface.name}-left-tgt`} 
                className={`node-handle target-handle left ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
                isConnectableStart={false}
              />
              <Handle 
                type="source" 
                position={Position.Left} 
                id={`${iface.name}-left-src`} 
                className={`node-handle source-handle left ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
              />

              <span className="port-name-label">{iface.name}</span>
              <span className="port-ip-label">{iface.ipAddress ? `${iface.ipAddress}/${iface.netmask}` : 'no IP'}</span>

              {/* 右側のハンドルペア (完全に重ねる) */}
              <Handle 
                type="target" 
                position={Position.Right} 
                id={`${iface.name}-right-tgt`} 
                className={`node-handle target-handle right ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
                isConnectableStart={false}
              />
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`${iface.name}-right-src`} 
                className={`node-handle source-handle right ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const HostNode = ({ id, data, selected }: NodeProps<HostNodeData>) => {
  const isUp = data.status === 'up';
  const edges = useTopologyStore(state => state.edges);
  const isConnected = checkIsPortConnected(id, 'eth1', edges);

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
        <div className="node-port-row" data-connected={isConnected}>
          {/* 左側のハンドルペア (完全に重ねる) */}
          <Handle 
            type="target" 
            position={Position.Left} 
            id="eth1-left-tgt" 
            className={`node-handle target-handle left ${isConnected ? 'connected' : ''}`}
            isConnectable={!isConnected}
            isConnectableStart={false}
          />
          <Handle 
            type="source" 
            position={Position.Left} 
            id="eth1-left-src" 
            className={`node-handle source-handle left ${isConnected ? 'connected' : ''}`}
            isConnectable={!isConnected}
          />

          <span className="port-name-label">eth1</span>
          <span className="port-ip-label">{data.ipAddress || 'no IP'}</span>

          {/* 右側のハンドルペア (完全に重ねる) */}
          <Handle 
            type="target" 
            position={Position.Right} 
            id="eth1-right-tgt" 
            className={`node-handle target-handle right ${isConnected ? 'connected' : ''}`}
            isConnectable={!isConnected}
            isConnectableStart={false}
          />
          <Handle 
            type="source" 
            position={Position.Right} 
            id="eth1-right-src" 
            className={`node-handle source-handle right ${isConnected ? 'connected' : ''}`}
            isConnectable={!isConnected}
          />
        </div>
      </div>
    </div>
  );
};

export const SwitchNode = ({ id, data, selected }: NodeProps<SwitchNodeData>) => {
  const isUp = data.status === 'up';
  const edges = useTopologyStore(state => state.edges);

  return (
    <div className={`custom-node switch-node ${selected ? 'selected' : ''} ${isUp ? 'up' : 'down'}`}>
      <div className="node-header">
        <div className="node-icon-wrapper">
          <Network size={20} className="node-icon" />
          <Activity size={8} className={`status-indicator ${isUp ? 'up' : 'down'}`} />
        </div>
        <div className="node-info">
          <span className="node-label">{data.label || 'Switch'}</span>
          <span className="node-status-text">{isUp ? 'Running' : 'Offline'}</span>
        </div>
      </div>
      
      {/* ポートの動的リスト */}
      <div className="node-ports-list">
        {(data.interfaces || []).map((iface) => {
          const isConnected = checkIsPortConnected(id, iface.name, edges);
          return (
            <div key={iface.name} className="node-port-row" data-connected={isConnected}>
              {/* 左側のハンドルペア (完全に重ねる) */}
              <Handle 
                type="target" 
                position={Position.Left} 
                id={`${iface.name}-left-tgt`} 
                className={`node-handle target-handle left ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
                isConnectableStart={false}
              />
              <Handle 
                type="source" 
                position={Position.Left} 
                id={`${iface.name}-left-src`} 
                className={`node-handle source-handle left ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
              />

              <span className="port-name-label">{iface.name}</span>
              <span className="port-ip-label">
                {iface.vlanMode === 'access' 
                  ? `VLAN ${iface.vlanId || 1}` 
                  : iface.vlanMode === 'trunk' 
                    ? `Trunk (${(iface.vlanIds || []).join(',') || 'all'})`
                    : 'no VLAN'}
              </span>

              {/* 右側のハンドルペア (完全に重ねる) */}
              <Handle 
                type="target" 
                position={Position.Right} 
                id={`${iface.name}-right-tgt`} 
                className={`node-handle target-handle right ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
                isConnectableStart={false}
              />
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`${iface.name}-right-src`} 
                className={`node-handle source-handle right ${isConnected ? 'connected' : ''}`}
                isConnectable={!isConnected}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
