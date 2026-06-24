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
import type { RouterNodeData, HostNodeData, NetworkEdgeData, SwitchNodeData } from '../types/topology';
import { getTopologyState, saveTopologyState, deleteTopologyState } from '../api/client';

interface TopologyState {
  nodes: Node[];
  edges: Edge[];
  deployedNodes: Node[];
  deployedEdges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hasChanges: boolean;
  isSaving: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  addNode: (type: 'router' | 'host' | 'switch') => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  updateNodeData: (nodeId: string, data: Partial<RouterNodeData> | Partial<HostNodeData> | Partial<SwitchNodeData> | any) => void;
  updateEdgeData: (edgeId: string, data: Partial<NetworkEdgeData>) => void;
  setTopology: (nodes: Node[], edges: Edge[]) => Promise<void>;
  setDeployedState: (nodes: Node[], edges: Edge[]) => void;
  addPort: (nodeId: string) => void;
  deletePort: (nodeId: string, portName: string) => void;
  saveState: (deployed?: boolean) => Promise<void>;
  loadState: () => Promise<void>;
  resetTopologyState: () => Promise<void>;
}

const initialRouterData = (label: string): RouterNodeData => ({
  label,
  status: 'down',
  interfaces: [
    { id: 'eth1', name: 'eth1', ipAddress: '', netmask: '' },
    { id: 'eth2', name: 'eth2', ipAddress: '', netmask: '' },
    { id: 'eth3', name: 'eth3', ipAddress: '', netmask: '' },
    { id: 'eth4', name: 'eth4', ipAddress: '', netmask: '' },
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

const initialSwitchData = (label: string): SwitchNodeData => ({
  label,
  status: 'down',
  interfaces: [
    { id: 'eth1', name: 'eth1', vlanMode: 'access', vlanId: 1, vlanIds: [] },
    { id: 'eth2', name: 'eth2', vlanMode: 'access', vlanId: 1, vlanIds: [] },
    { id: 'eth3', name: 'eth3', vlanMode: 'access', vlanId: 1, vlanIds: [] },
    { id: 'eth4', name: 'eth4', vlanMode: 'access', vlanId: 1, vlanIds: [] },
  ],
});


function cleanNodeForComparison(node: any) {
  const { position, positionAbsolute, width, height, selected, dragging, ...rest } = node;
  const cleanedData = rest.data ? { ...rest.data } : {};
  delete cleanedData.status;
  return {
    id: rest.id,
    type: rest.type,
    data: cleanedData
  };
}

function cleanEdgeForComparison(edge: any) {
  const { selected, ...rest } = edge;
  return rest;
}

export function checkHasChanges(nodes: any[], edges: any[], deployedNodes: any[], deployedEdges: any[]): boolean {
  const cleanNodes = nodes.map(cleanNodeForComparison).sort((a, b) => a.id.localeCompare(b.id));
  const cleanDeployedNodes = deployedNodes.map(cleanNodeForComparison).sort((a, b) => a.id.localeCompare(b.id));

  const cleanEdges = edges.map(cleanEdgeForComparison).sort((a, b) => a.id.localeCompare(b.id));
  const cleanDeployedEdges = deployedEdges.map(cleanEdgeForComparison).sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify(cleanNodes) !== JSON.stringify(cleanDeployedNodes) ||
         JSON.stringify(cleanEdges) !== JSON.stringify(cleanDeployedEdges);
}

let autoSaveTimeoutId: any = null;

function triggerAutoSave() {
  if (autoSaveTimeoutId) {
    clearTimeout(autoSaveTimeoutId);
  }
  autoSaveTimeoutId = setTimeout(() => {
    useTopologyStore.getState().saveState(false);
  }, 2000);
}

export const useTopologyStore = create<TopologyState>((rawSet) => {
  const set = (
    fn: Partial<TopologyState> | ((state: TopologyState) => Partial<TopologyState> | TopologyState)
  ) => {
    rawSet((state) => {
      const nextState = typeof fn === 'function' ? fn(state) : fn;
      const newNodes = nextState.nodes !== undefined ? nextState.nodes : state.nodes;
      const newEdges = nextState.edges !== undefined ? nextState.edges : state.edges;
      const newDeployedNodes = nextState.deployedNodes !== undefined ? nextState.deployedNodes : state.deployedNodes;
      const newDeployedEdges = nextState.deployedEdges !== undefined ? nextState.deployedEdges : state.deployedEdges;
      
      const hasChanges = checkHasChanges(newNodes, newEdges, newDeployedNodes, newDeployedEdges);
      
      if (nextState.nodes !== undefined || nextState.edges !== undefined) {
        triggerAutoSave();
      }
      
      return {
        ...nextState,
        hasChanges
      };
    });
  };

  return {
  nodes: [
    {
      id: 'router-1',
      type: 'router',
      position: { x: 200, y: 250 },
      data: initialRouterData('Router-A'),
    },
    {
      id: 'router-2',
      type: 'router',
      position: { x: 500, y: 250 },
      data: initialRouterData('Router-B'),
    },
    {
      id: 'host-1',
      type: 'host',
      position: { x: 200, y: 500 },
      data: initialHostData('Host-A'),
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'router-1',
      target: 'host-1',
      sourceHandle: 'eth1-left-src',
      targetHandle: 'eth1-right-tgt',
      type: 'networkEdge',
      data: { sourceInterface: 'eth1', targetInterface: 'eth1' }
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
      const cleanHandle = (h: string | null | undefined) => h ? h.replace(/-(left|right)-(src|tgt)$/, '') : 'eth1';
      const sourcePort = cleanHandle(connection.sourceHandle);
      const targetPort = cleanHandle(connection.targetHandle);

      const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
          } else if (node.type === 'switch') {
            const data = node.data as SwitchNodeData;
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
          } else if (node.type === 'switch') {
            const data = node.data as SwitchNodeData;
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

  addNode: (type: 'router' | 'host' | 'switch') => {
    set((state) => {
      const id = `${type}-${Date.now()}`;
      
      const getNextUnusedLetter = (nodeType: 'router' | 'host' | 'switch') => {
        const prefix = nodeType === 'router' ? 'Router-' : nodeType === 'host' ? 'Host-' : 'Switch-';
        const existingLabels = state.nodes
          .filter(n => n.type === nodeType)
          .map(n => n.data.label || '');
        
        for (let i = 0; i < 26; i++) {
          const letter = String.fromCharCode(65 + i);
          const candidateLabel = `${prefix}${letter}`;
          if (!existingLabels.includes(candidateLabel)) {
            return letter;
          }
        }
        return String.fromCharCode(65 + (existingLabels.length % 26));
      };

      const letter = getNextUnusedLetter(type);
      const label = type === 'router' 
        ? `Router-${letter}` 
        : type === 'host'
          ? `Host-${letter}`
          : `Switch-${letter}`;
      
      const initialData = type === 'router' 
        ? initialRouterData(label) 
        : type === 'host'
          ? initialHostData(label)
          : initialSwitchData(label);

      const newNode: Node = {
        id,
        type,
        position: { x: 350 + state.nodes.length * 15, y: 350 + state.nodes.length * 15 },
        data: initialData,
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
            } else if (node.type === 'switch') {
              const data = node.data as SwitchNodeData;
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
            } else if (node.type === 'switch') {
              const data = node.data as SwitchNodeData;
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

  setTopology: async (nodes: Node[], edges: Edge[]) => {
    let activeNodes: string[] = [];
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const statusRes = await fetch(`${API_BASE_URL}/topology/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === 'running') {
          activeNodes = (statusData.nodes || []).map((n: any) => n.name);
        }
      }
    } catch (e) {
      console.error('Failed to fetch topology status during setTopology:', e);
    }

    const mergedNodes = nodes.map((node) => {
      const isUp = activeNodes.some(name => name === node.id || name.endsWith(`-${node.id}`));
      return {
        ...node,
        data: {
          ...node.data,
          status: isUp ? 'up' : 'down'
        }
      };
    });

    set({
      nodes: mergedNodes,
      edges,
      selectedNodeId: null,
      selectedEdgeId: null
    });
  },

  addPort: (nodeId: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          if (node.type === 'router') {
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
          } else if (node.type === 'switch') {
            const data = node.data as SwitchNodeData;
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
                  { id: nextPortName, name: nextPortName, vlanMode: 'access', vlanId: 1, vlanIds: [] }
                ]
              }
            };
          }
        }
        return node;
      })
    }));
  },

  deletePort: (nodeId: string, portName: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          if (node.type === 'router') {
            const data = node.data as RouterNodeData;
            return {
              ...node,
              data: {
                ...data,
                interfaces: data.interfaces.filter(i => i.name !== portName)
              }
            };
          } else if (node.type === 'switch') {
            const data = node.data as SwitchNodeData;
            return {
              ...node,
              data: {
                ...data,
                interfaces: data.interfaces.filter(i => i.name !== portName)
              }
            };
          }
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

  deployedNodes: [],
  deployedEdges: [],
  hasChanges: false,
  isSaving: false,

  setDeployedState: (nodes: Node[], edges: Edge[]) => {
    const deepCopyNodes = JSON.parse(JSON.stringify(nodes));
    const deepCopyEdges = JSON.parse(JSON.stringify(edges));
    set({
      deployedNodes: deepCopyNodes,
      deployedEdges: deepCopyEdges,
    });
  },

  saveState: async (deployed: boolean = false) => {
    const { nodes, edges } = useTopologyStore.getState();
    rawSet({ isSaving: true });
    try {
      const result = await saveTopologyState({ nodes, edges }, deployed);
      if (result.success || (result as any).status === 'success') {
        if (deployed) {
          const deepCopyNodes = JSON.parse(JSON.stringify(nodes));
          const deepCopyEdges = JSON.parse(JSON.stringify(edges));
          rawSet({
            deployedNodes: deepCopyNodes,
            deployedEdges: deepCopyEdges,
            hasChanges: false
          });
        }
      }
    } catch (e) {
      console.error('Failed to save state:', e);
    } finally {
      rawSet({ isSaving: false });
    }
  },

  loadState: async () => {
    try {
      const state = await getTopologyState(false);
      const deployedState = await getTopologyState(true);
      
      const loadedNodes = state.nodes || [];
      const loadedEdges = state.edges || [];
      const loadedDeployedNodes = deployedState.nodes || [];
      const loadedDeployedEdges = deployedState.edges || [];

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const statusRes = await fetch(`${API_BASE_URL}/topology/status`);
      let activeNodes: string[] = [];
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === 'running') {
          activeNodes = (statusData.nodes || []).map((n: any) => n.name);
        }
      }
      
      const mergedNodes = loadedNodes.map((node: any) => {
        const isUp = activeNodes.some(name => name === node.id || name.endsWith(`-${node.id}`));
        return {
          ...node,
          data: {
            ...node.data,
            status: isUp ? 'up' : 'down'
          }
        };
      });

      const nextHasChanges = checkHasChanges(mergedNodes, loadedEdges, loadedDeployedNodes, loadedDeployedEdges);

      rawSet({
        nodes: mergedNodes,
        edges: loadedEdges,
        deployedNodes: loadedDeployedNodes,
        deployedEdges: loadedDeployedEdges,
        hasChanges: nextHasChanges
      });
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  },

  resetTopologyState: async () => {
    try {
      await deleteTopologyState();
      
      const defaultNodes: Node[] = [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 200, y: 250 },
          data: initialRouterData('Router-A'),
        },
        {
          id: 'router-2',
          type: 'router',
          position: { x: 500, y: 250 },
          data: initialRouterData('Router-B'),
        },
        {
          id: 'host-1',
          type: 'host',
          position: { x: 200, y: 500 },
          data: initialHostData('Host-A'),
        },
      ];
      const defaultEdges: Edge[] = [
        {
          id: 'edge-1',
          source: 'router-1',
          target: 'host-1',
          sourceHandle: 'eth1-left-src',
          targetHandle: 'eth1-right-tgt',
          type: 'networkEdge',
          data: { sourceInterface: 'eth1', targetInterface: 'eth1' }
        }
      ];

      rawSet({
        nodes: defaultNodes,
        edges: defaultEdges,
        deployedNodes: [],
        deployedEdges: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        hasChanges: true
      });
    } catch (e) {
      console.error('Failed to reset topology state:', e);
    }
  },
};
});
