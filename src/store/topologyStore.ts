import { create } from 'zustand';
import { 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge
} from 'reactflow';
import type { 
  Node, 
  Edge, 
  OnNodesChange, 
  OnEdgesChange, 
  Connection, 
  NodeChange, 
  EdgeChange 
} from 'reactflow';
import type { RouterNodeData, HostNodeData, NetworkEdgeData } from '../types/topology';

interface TopologyState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  addNode: (type: 'router' | 'host') => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  updateNodeData: (nodeId: string, data: Partial<RouterNodeData> | Partial<HostNodeData> | any) => void;
  updateEdgeData: (edgeId: string, data: Partial<NetworkEdgeData>) => void;
  setTopology: (nodes: Node[], edges: Edge[]) => void;
  addPort: (nodeId: string) => void;
  deletePort: (nodeId: string, portName: string) => void;
}

const initialRouterData = (label: string): RouterNodeData => ({
  label,
  status: 'down',
  interfaces: [
    { id: 'eth0', name: 'eth0', ipAddress: '', netmask: '' },
    { id: 'eth1', name: 'eth1', ipAddress: '', netmask: '' },
    { id: 'eth2', name: 'eth2', ipAddress: '', netmask: '' },
    { id: 'eth3', name: 'eth3', ipAddress: '', netmask: '' },
  ],
  vlanInterfaces: [],
  routing: {
    ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
    rip: { enabled: false, networks: [], interfaces: [] },
    bgp: { enabled: false, asNumber: 65001, routerId: '', neighbors: [] },
  },
  staticRoutes: [],
});

const initialHostData = (label: string): HostNodeData => ({
  label,
  status: 'down',
  ipAddress: '',
  gateway: '',
  vlanInterfaces: [],
});

export const useTopologyStore = create<TopologyState>((set) => ({
  nodes: [
    {
      id: 'router-1',
      type: 'router',
      position: { x: 250, y: 150 },
      data: initialRouterData('Router-A'),
    },
    {
      id: 'router-2',
      type: 'router',
      position: { x: 500, y: 150 },
      data: initialRouterData('Router-B'),
    },
    {
      id: 'host-1',
      type: 'host',
      position: { x: 100, y: 350 },
      data: initialHostData('Host-A'),
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'router-1',
      target: 'host-1',
      sourceHandle: 'eth0',
      targetHandle: 'eth0',
      data: { sourceInterface: 'eth0', targetInterface: 'eth0' }
    }
  ],
  selectedNodeId: null,
  selectedEdgeId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection: Connection) => {
    set((state) => {
      const cleanHandle = (h: string | null | undefined) => h ? h.replace(/-(left|right)-(src|tgt)$/, '') : 'eth0';
      const sourcePort = cleanHandle(connection.sourceHandle);
      const targetPort = cleanHandle(connection.targetHandle);

      // 既存のエッジに同じポートが使われていないかチェックし、必要に応じてポートの接続状態を割り当てる
      const newEdgeId = `edge-${Date.now()}`;
      const newEdge: Edge = {
        id: newEdgeId,
        source: connection.source || '',
        target: connection.target || '',
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'networkEdge',
        data: {
          sourceInterface: sourcePort,
          targetInterface: targetPort
        }
      };

      // ノードの接続先を更新する
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === connection.source && connection.target) {
          if (node.type === 'router') {
            const data = node.data as RouterNodeData;
            return {
              ...node,
              data: {
                ...data,
                interfaces: data.interfaces.map(i => 
                  i.name === sourcePort ? { ...i, connectedTo: connection.target || undefined } : i
                )
              }
            };
          } else {
            const data = node.data as HostNodeData;
            return {
              ...node,
              data: {
                ...data,
                connectedTo: connection.target || undefined
              }
            };
          }
        }
        if (node.id === connection.target && connection.source) {
          if (node.type === 'router') {
            const data = node.data as RouterNodeData;
            return {
              ...node,
              data: {
                ...data,
                interfaces: data.interfaces.map(i => 
                  i.name === targetPort ? { ...i, connectedTo: connection.source || undefined } : i
                )
              }
            };
          } else {
            const data = node.data as HostNodeData;
            return {
              ...node,
              data: {
                ...data,
                connectedTo: connection.source || undefined
              }
            };
          }
        }
        return node;
      });

      return {
        nodes: updatedNodes,
        edges: addEdge(newEdge, state.edges),
      };
    });
  },

  selectNode: (id: string | null) => {
    set({ selectedNodeId: id, selectedEdgeId: null });
  },

  selectEdge: (id: string | null) => {
    set({ selectedEdgeId: id, selectedNodeId: null });
  },

  addNode: (type: 'router' | 'host') => {
    set((state) => {
      const id = `${type}-${Date.now()}`;
      const label = type === 'router' ? `Router-${String.fromCharCode(65 + state.nodes.filter(n => n.type === 'router').length)}` : `Host-${String.fromCharCode(65 + state.nodes.filter(n => n.type === 'host').length)}`;
      const newNode: Node = {
        id,
        type,
        position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
        data: type === 'router' ? initialRouterData(label) : initialHostData(label),
      };
      return {
        nodes: [...state.nodes, newNode],
      };
    });
  },

  deleteNode: (id: string) => {
    set((state) => {
      const filteredNodes = state.nodes.filter(node => node.id !== id);
      const filteredEdges = state.edges.filter(edge => edge.source !== id && edge.target !== id);
      const selectedNodeId = state.selectedNodeId === id ? null : state.selectedNodeId;
      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        selectedNodeId,
      };
    });
  },

  deleteEdge: (id: string) => {
    set((state) => {
      const edge = state.edges.find(e => e.id === id);
      const filteredEdges = state.edges.filter(e => e.id !== id);
      const selectedEdgeId = state.selectedEdgeId === id ? null : state.selectedEdgeId;
      
      let updatedNodes = state.nodes;
      if (edge) {
        // ノードの接続情報を削除
        updatedNodes = state.nodes.map(node => {
          if (node.id === edge.source) {
            if (node.type === 'router') {
              const data = node.data as RouterNodeData;
              return {
                ...node,
                data: {
                  ...data,
                  interfaces: data.interfaces.map(i => i.name === edge.sourceHandle ? { ...i, connectedTo: undefined } : i)
                }
              };
            } else {
              const data = node.data as HostNodeData;
              return { ...node, data: { ...data, connectedTo: undefined } };
            }
          }
          if (node.id === edge.target) {
            if (node.type === 'router') {
              const data = node.data as RouterNodeData;
              return {
                ...node,
                data: {
                  ...data,
                  interfaces: data.interfaces.map(i => i.name === edge.targetHandle ? { ...i, connectedTo: undefined } : i)
                }
              };
            } else {
              const data = node.data as HostNodeData;
              return { ...node, data: { ...data, connectedTo: undefined } };
            }
          }
          return node;
        });
      }

      return {
        nodes: updatedNodes,
        edges: filteredEdges,
        selectedEdgeId,
      };
    });
  },

  updateNodeData: (nodeId: string, data: any) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...data,
            },
          };
        }
        return node;
      }),
    }));
  },

  updateEdgeData: (edgeId: string, data: Partial<NetworkEdgeData>) => {
    set((state) => ({
      edges: state.edges.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            data: {
              ...edge.data,
              ...data,
            },
          };
        }
        return edge;
      }),
    }));
  },

  setTopology: (nodes: Node[], edges: Edge[]) => {
    set({ nodes, edges, selectedNodeId: null, selectedEdgeId: null });
  },

  addPort: (nodeId: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId && node.type === 'router') {
          const data = node.data as RouterNodeData;
          const currentMax = data.interfaces.reduce((max, i) => {
            const num = parseInt(i.name.replace('eth', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, -1);
          const nextIndex = currentMax + 1;
          const nextPortName = `eth${nextIndex}`;
          return {
            ...node,
            data: {
              ...data,
              interfaces: [
                ...data.interfaces,
                { id: nextPortName, name: nextPortName, ipAddress: '', netmask: '' }
              ]
            }
          };
        }
        return node;
      })
    }));
  },

  deletePort: (nodeId: string, portName: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId && node.type === 'router') {
          const data = node.data as RouterNodeData;
          return {
            ...node,
            data: {
              ...data,
              interfaces: data.interfaces.filter(i => i.name !== portName)
            }
          };
        }
        return node;
      }),
      edges: state.edges.filter((edge) => {
        const cleanHandle = (h: string | null | undefined) => h ? h.replace(/-(left|right)-(src|tgt)$/, '') : '';
        if (edge.source === nodeId && cleanHandle(edge.sourceHandle) === portName) return false;
        if (edge.target === nodeId && cleanHandle(edge.targetHandle) === portName) return false;
        return true;
      })
    }));
  },
}));
