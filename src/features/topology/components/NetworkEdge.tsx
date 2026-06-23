import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { NetworkEdgeData } from '../../../types/topology';
import './NetworkEdge.css';

export default function NetworkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps<NetworkEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  // 帯域設定などがある場合はアクティブな実線、それ以外は設定を視覚化するためのスタイルに
  const isConfigured = !!(data?.bandwidth || data?.delay || data?.cost);

  return (
    <>
      <path
        id={id}
        style={style}
        className={`react-flow__edge-path network-edge-path ${selected ? 'selected' : ''} ${!isConfigured ? 'dashed' : ''}`}
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="edge-badge-container"
        >
          {/* ポート番号を表示 */}
          <div className="edge-ports">
            <span className="edge-port-label source">{data?.sourceInterface}</span>
            <span className="edge-divider">-</span>
            <span className="edge-port-label target">{data?.targetInterface}</span>
          </div>
          
          {/* メトリクス情報バッジ */}
          {isConfigured && (
            <div className="edge-metrics-badge">
              {data?.bandwidth && <span className="metric-item">{data.bandwidth}</span>}
              {data?.delay && <span className="metric-item">{data.delay}</span>}
              {data?.cost !== undefined && <span className="metric-item cost-badge">Cost: {data.cost}</span>}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
