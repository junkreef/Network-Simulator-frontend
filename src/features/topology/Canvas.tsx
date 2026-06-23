import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import type { NodeTypes, EdgeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { useTopologyStore } from '../../store/topologyStore';
import { RouterNode, HostNode, SwitchNode } from './components/CustomNodes';
import NetworkEdge from './components/NetworkEdge';
import './Canvas.css';

export default function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
    addNode,
  } = useTopologyStore();

  const nodeTypes = useMemo<NodeTypes>(() => ({
    router: RouterNode,
    host: HostNode,
    switch: SwitchNode,
  }), []);

  const edgeTypes = useMemo<EdgeTypes>(() => ({
    networkEdge: NetworkEdge,
  }), []);

  return (
    <div className="canvas-container" data-testid="canvas-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="rgba(255, 255, 255, 0.05)" />
        <Controls showInteractive={false} className="canvas-controls" />
        <MiniMap
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          nodeColor={(node) => {
            if (node.type === 'router') return 'var(--color-primary)';
            if (node.type === 'switch') return 'var(--color-info)';
            return 'var(--color-success)';
          }}
          maskColor="rgba(11, 15, 25, 0.7)"
        />
      </ReactFlow>

      {/* ノード追加用のフローティングパレット */}
      <div className="canvas-toolbar">
        <button onClick={() => addNode('router')} className="toolbar-btn router-btn" data-testid="add-router-btn">
          + ルーター追加
        </button>
        <button onClick={() => addNode('switch')} className="toolbar-btn switch-btn" data-testid="add-switch-btn" style={{ borderLeft: '1px solid var(--border-color)' }}>
          + スイッチ追加
        </button>
        <button onClick={() => addNode('host')} className="toolbar-btn host-btn" data-testid="add-host-btn" style={{ borderLeft: '1px solid var(--border-color)' }}>
          + ホスト追加
        </button>
      </div>
    </div>
  );
}
