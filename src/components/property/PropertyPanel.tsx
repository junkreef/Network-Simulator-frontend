import { useState, useEffect } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import type { NetworkEdgeData, VlanInterfaceData } from '../../types/topology';
import { getNodeStatus } from '../../api/client';
import { Trash2, Plus, X, RefreshCw } from 'lucide-react';
import './PropertyPanel.css';

// エリアIDからコントラストの高い一意のHSLカラーを生成するヘルパー関数（ダークテーマ用）
// 隣接するエリアID（例: 0.0.0.0 と 0.0.0.1）で色が似てしまわないよう、黄金角（137.5度）を用いて色相を最大分散させます。
const getAreaColor = (areaId: string): string => {
  if (!areaId) return 'var(--border-color)';
  
  let num = 0;
  if (areaId.includes('.')) {
    const parts = areaId.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      // 32bit無符号整数に変換
      num = parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
    }
  } else {
    const parsed = parseInt(areaId, 10);
    if (!isNaN(parsed)) {
      num = parsed;
    } else {
      // 文字列の簡易ハッシュフォールバック
      let hash = 0;
      for (let i = 0; i < areaId.length; i++) {
        hash = areaId.charCodeAt(i) + ((hash << 5) - hash);
      }
      num = Math.abs(hash);
    }
  }
  
  // 黄金角（約137.5度）を掛けることで、隣り合う数値の色相を円周上で最大限離します
  const h = Math.round((num * 137.5) % 360);
  return `hsl(${h}, 75%, 60%)`;
};


export default function PropertyPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    deleteEdge,
    addPort,
    deletePort,
  } = useTopologyStore();

  const [activeTab, setActiveTab] = useState<'config' | 'status'>('config');
  const [statusType, setStatusType] = useState<string>('routing_table');
  const [statusOutput, setStatusOutput] = useState<string>('');
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);

  // VLAN追加用のローカルステート
  const [vlanParent, setVlanParent] = useState<string>('eth1');
  const [vlanIdInput, setVlanIdInput] = useState<string>('');
  const [vlanIpInput, setVlanIpInput] = useState<string>('');

  // OSPFエリア追加用 / レンジ追加用ローカルステート
  const [newAreaIdInput, setNewAreaIdInput] = useState<string>('');
  const [areaRangeInputs, setAreaRangeInputs] = useState<Record<string, string>>({});

  // RIPネットワーク追加用
  const [ripNetworkInput, setRipNetworkInput] = useState<string>('');

  // BGPネイバー追加用
  const [bgpNeighborIp, setBgpNeighborIp] = useState<string>('');
  const [bgpNeighborAs, setBgpNeighborAs] = useState<string>('');

  // スタティックルート追加用
  const [staticDest, setStaticDest] = useState<string>('');
  const [staticNextHop, setStaticNextHop] = useState<string>('');

  // ルーター物理インターフェースの一時入力用ステート
  const [interfaceInputs, setInterfaceInputs] = useState<Record<string, string>>({});
  // スイッチトランクポートVLAN入力の一時用ステート
  const [vlanIdsInputs, setVlanIdsInputs] = useState<Record<string, string>>({});
  
  // ルーターVLANサブインターフェース一時入力用ステート
  const [vlanIdInputs, setVlanIdInputs] = useState<Record<number, string>>({});
  const [vlanIpInputs, setVlanIpInputs] = useState<Record<number, string>>({});
  
  const [prevNodeId, setPrevNodeId] = useState<string | null>(null);
  const [prevInterfacesLength, setPrevInterfacesLength] = useState<number>(0);
  const [prevVlansLength, setPrevVlansLength] = useState<number>(0);

  // 選択中の要素を取得
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // 選択が変わったら出力をリセットし、VLAN親ポートのデフォルトを更新
  useEffect(() => {
    setStatusOutput('');
    if (selectedNode) {
      if (selectedNode.type === 'router') {
        const firstIface = selectedNode.data.interfaces?.[0]?.name || 'eth1';
        setVlanParent(firstIface);

        const currentLength = selectedNode.data.interfaces?.length || 0;
        // ノードが切り替わったか、インターフェースの数が変わった場合のみ初期化
        if (selectedNodeId !== prevNodeId || currentLength !== prevInterfacesLength) {
          const inputs: Record<string, string> = {};
          (selectedNode.data.interfaces || []).forEach((iface: any) => {
            inputs[iface.id] = iface.ipAddress && iface.netmask 
              ? `${iface.ipAddress}/${iface.netmask}` 
              : iface.ipAddress || '';
          });
          setInterfaceInputs(inputs);
          setPrevNodeId(selectedNodeId);
          setPrevInterfacesLength(currentLength);
        }

        // VLAN一時ステート初期化
        const currentVlansLength = selectedNode.data.vlanInterfaces?.length || 0;
        if (selectedNodeId !== prevNodeId || currentVlansLength !== prevVlansLength) {
          const idInputs: Record<number, string> = {};
          const ipInputs: Record<number, string> = {};
          (selectedNode.data.vlanInterfaces || []).forEach((v: any, idx: number) => {
            idInputs[idx] = String(v.vlanId);
            ipInputs[idx] = v.ipAddress;
          });
          setVlanIdInputs(idInputs);
          setVlanIpInputs(ipInputs);
          setPrevVlansLength(currentVlansLength);
        }
      } else if (selectedNode.type === 'switch') {
        const currentLength = selectedNode.data.interfaces?.length || 0;
        if (selectedNodeId !== prevNodeId || currentLength !== prevInterfacesLength) {
          const inputs: Record<string, string> = {};
          (selectedNode.data.interfaces || []).forEach((iface: any) => {
            inputs[iface.id] = Array.isArray(iface.vlanIds) ? iface.vlanIds.join(',') : iface.vlanIds || '';
          });
          setVlanIdsInputs(inputs);
          setPrevNodeId(selectedNodeId);
          setPrevInterfacesLength(currentLength);
        }
      } else if (selectedNode.type === 'host') {
        setVlanParent('eth1');
      }
    } else {
      setPrevNodeId(null);
      setPrevInterfacesLength(0);
      setPrevVlansLength(0);
    }
  }, [selectedNodeId, statusType, selectedNode, prevNodeId, prevInterfacesLength, prevVlansLength]);

  const handleRefreshStatus = async () => {
    if (!selectedNodeId) return;
    setIsLoadingStatus(true);
    setStatusOutput('Fetching status from node...');
    try {
      const output = await getNodeStatus(selectedNodeId, statusType);
      setStatusOutput(output || 'No output.');
    } catch (e) {
      setStatusOutput('Failed to fetch runtime status.');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="property-panel empty" data-testid="property-panel-empty">
        <p>ノードまたはエッジを選択して設定を編集します。</p>
      </div>
    );
  }

  // エッジ（リンク）設定表示
  if (selectedEdge) {
    const edgeData = (selectedEdge.data || {}) as NetworkEdgeData;

    const handleEdgeChange = (field: keyof NetworkEdgeData, value: any) => {
      updateEdgeData(selectedEdge.id, { [field]: value });
    };

    return (
      <div className="property-panel" data-testid="property-panel-edge">
        <div className="panel-header">
          <h3>リンク設定 ({selectedEdge.id})</h3>
          <button onClick={() => deleteEdge(selectedEdge.id)} className="delete-btn" title="リンク削除">
            <Trash2 size={16} />
          </button>
        </div>
        <div className="panel-content">
          <div className="form-group">
            <label>送信元ポート: {edgeData.sourceInterface || 'eth?'}</label>
          </div>
          <div className="form-group">
            <label>送信先ポート: {edgeData.targetInterface || 'eth?'}</label>
          </div>
          <div className="form-group">
            <label htmlFor="edge-bandwidth">帯域幅 (Bandwidth)</label>
            <input
              id="edge-bandwidth"
              type="text"
              placeholder="e.g. 100mbit, 1gbit"
              value={edgeData.bandwidth || ''}
              onChange={(e) => handleEdgeChange('bandwidth', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edge-delay">遅延 (Delay)</label>
            <input
              id="edge-delay"
              type="text"
              placeholder="e.g. 10ms, 50ms"
              value={edgeData.delay || ''}
              onChange={(e) => handleEdgeChange('delay', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edge-cost">OSPF コスト</label>
            <input
              id="edge-cost"
              type="number"
              placeholder="10"
              value={edgeData.cost !== undefined ? edgeData.cost : ''}
              onChange={(e) => handleEdgeChange('cost', e.target.value ? parseInt(e.target.value, 10) : undefined)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ここで selectedNode の存在を確定させる
  if (!selectedNode) return null;

  // ノード設定表示
  const isRouter = selectedNode.type === 'router';
  const nodeData = selectedNode.data;

  const handleLabelChange = (val: string) => {
    updateNodeData(selectedNode.id, { label: val });
  };

  const handleStatusToggle = () => {
    updateNodeData(selectedNode.id, { status: nodeData.status === 'up' ? 'down' : 'up' });
  };

  // --- ルーター用ハンドラ ---
  const handleInterfaceChange = (index: number, fields: Record<string, string>) => {
    const updated = [...(nodeData.interfaces || [])];
    updated[index] = { ...updated[index], ...fields };
    updateNodeData(selectedNode.id, { interfaces: updated });
  };

  const handleAddVlan = () => {
    if (!vlanIdInput || !vlanIpInput) return;
    const vlanId = parseInt(vlanIdInput, 10);
    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) return;

    const newVlan: VlanInterfaceData = {
      name: `${vlanParent}.${vlanId}`,
      parentInterface: vlanParent,
      vlanId,
      ipAddress: vlanIpInput,
    };

    const currentVlans = nodeData.vlanInterfaces || [];
    updateNodeData(selectedNode.id, {
      vlanInterfaces: [...currentVlans, newVlan],
    });
    setVlanIdInput('');
    setVlanIpInput('');
  };

  const handleRemoveVlan = (name: string) => {
    const currentVlans = nodeData.vlanInterfaces || [];
    updateNodeData(selectedNode.id, {
      vlanInterfaces: currentVlans.filter((v: VlanInterfaceData) => v.name !== name),
    });
  };

  const handleVlanFieldChange = (index: number, field: keyof VlanInterfaceData, value: any) => {
    const updated = [...(nodeData.vlanInterfaces || [])];
    const target = updated[index];
    if (!target) return;

    const oldName = target.name;
    const newVlan = { ...target, [field]: value };

    if (field === 'parentInterface' || field === 'vlanId') {
      newVlan.name = `${newVlan.parentInterface}.${newVlan.vlanId}`;
    }

    updated[index] = newVlan;

    const newRouting = { ...nodeData.routing };
    if (newRouting.ospf?.areas) {
      newRouting.ospf.areas = newRouting.ospf.areas.map((area: any) => ({
        ...area,
        interfaces: (area.interfaces || []).map((i: string) => i === oldName ? newVlan.name : i)
      }));
    }
    if (newRouting.rip?.interfaces?.includes(oldName)) {
      newRouting.rip.interfaces = newRouting.rip.interfaces.map((i: string) => i === oldName ? newVlan.name : i);
    }

    updateNodeData(selectedNode.id, {
      vlanInterfaces: updated,
      routing: newRouting,
    });
  };

  // OSPF
  const handleOspfToggle = () => {
    const ospf = nodeData.routing?.ospf || {
      enabled: false,
      routerId: '',
      areas: [],
      redistribute: { connected: false, static: false, rip: false, bgp: false },
      defaultInformationOriginate: { enabled: false, always: false }
    };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: { ...ospf, enabled: !ospf.enabled },
      },
    });
  };

  const handleOspfFieldChange = (field: string, value: any) => {
    const ospf = nodeData.routing?.ospf || {
      enabled: false,
      routerId: '',
      areas: [],
      redistribute: { connected: false, static: false, rip: false, bgp: false },
      defaultInformationOriginate: { enabled: false, always: false }
    };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: { ...ospf, [field]: value },
      },
    });
  };

  const handleAddOspfArea = () => {
    if (!newAreaIdInput) return;
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    if (!areas.some((a: any) => a.areaId === newAreaIdInput)) {
      const newArea = {
        areaId: newAreaIdInput,
        interfaces: [],
        ranges: [],
        areaType: 'normal'
      };
      handleOspfFieldChange('areas', [...areas, newArea]);
    }
    setNewAreaIdInput('');
  };

  const handleRemoveOspfArea = (areaId: string) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    handleOspfFieldChange('areas', areas.filter((a: any) => a.areaId !== areaId));
  };

  const handleOspfAreaFieldChange = (areaId: string, field: string, value: any) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    const updated = areas.map((a: any) => {
      if (a.areaId === areaId) {
        return { ...a, [field]: value };
      }
      return a;
    });
    handleOspfFieldChange('areas', updated);
  };

  const handleOspfAreaInterfaceToggle = (areaId: string, ifName: string) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    const area = areas.find((a: any) => a.areaId === areaId);
    if (!area) return;
    const interfaces = area.interfaces || [];
    const updatedInterfaces = interfaces.includes(ifName)
      ? interfaces.filter((i: string) => i !== ifName)
      : [...interfaces, ifName];
    
    // Remove interface from other areas to prevent duplicate assignment
    const updatedAreas = areas.map((a: any) => {
      if (a.areaId === areaId) {
        return { ...a, interfaces: updatedInterfaces };
      }
      return {
        ...a,
        interfaces: (a.interfaces || []).filter((i: string) => i !== ifName)
      };
    });
    handleOspfFieldChange('areas', updatedAreas);
  };

  const handleAddOspfAreaRange = (areaId: string) => {
    const val = areaRangeInputs[areaId] || '';
    if (!val) return;
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    const area = areas.find((a: any) => a.areaId === areaId);
    if (!area) return;
    const ranges = area.ranges || [];
    if (!ranges.includes(val)) {
      const updatedAreas = areas.map((a: any) => {
        if (a.areaId === areaId) {
          return { ...a, ranges: [...ranges, val] };
        }
        return a;
      });
      handleOspfFieldChange('areas', updatedAreas);
    }
    setAreaRangeInputs({ ...areaRangeInputs, [areaId]: '' });
  };

  const handleRemoveOspfAreaRange = (areaId: string, range: string) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areas: [] };
    const areas = ospf.areas || [];
    const area = areas.find((a: any) => a.areaId === areaId);
    if (!area) return;
    const ranges = area.ranges || [];
    const updatedAreas = areas.map((a: any) => {
      if (a.areaId === areaId) {
        return { ...a, ranges: ranges.filter((r: string) => r !== range) };
      }
      return a;
    });
    handleOspfFieldChange('areas', updatedAreas);
  };

  const handleOspfDefaultRouteToggle = () => {
    const ospf = nodeData.routing?.ospf || {};
    const dio = ospf.defaultInformationOriginate || { enabled: false, always: false };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: {
          ...ospf,
          defaultInformationOriginate: {
            ...dio,
            enabled: !dio.enabled
          }
        }
      }
    });
  };

  const handleOspfDefaultRouteAlwaysToggle = () => {
    const ospf = nodeData.routing?.ospf || {};
    const dio = ospf.defaultInformationOriginate || { enabled: false, always: false };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: {
          ...ospf,
          defaultInformationOriginate: {
            ...dio,
            always: !dio.always
          }
        }
      }
    });
  };

  // Redistribution Checkbox Toggler
  const handleRedistributeToggle = (protocol: 'ospf' | 'rip' | 'bgp', source: string) => {
    const protoConfig = nodeData.routing?.[protocol] || {};
    const redistribute = protoConfig.redistribute || {};
    const updatedRedistribute = {
      ...redistribute,
      [source]: !redistribute[source]
    };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        [protocol]: {
          ...protoConfig,
          redistribute: updatedRedistribute
        }
      }
    });
  };

  // RIP
  const handleRipToggle = () => {
    const rip = nodeData.routing?.rip || { enabled: false, networks: [], interfaces: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        rip: { ...rip, enabled: !rip.enabled },
      },
    });
  };

  const handleAddRipNetwork = () => {
    if (!ripNetworkInput) return;
    const rip = nodeData.routing?.rip || { enabled: false, networks: [], interfaces: [] };
    const networks = rip.networks || [];
    if (!networks.includes(ripNetworkInput)) {
      updateNodeData(selectedNode.id, {
        routing: {
          ...nodeData.routing,
          rip: { ...rip, networks: [...networks, ripNetworkInput] },
        },
      });
    }
    setRipNetworkInput('');
  };

  const handleRemoveRipNetwork = (net: string) => {
    const rip = nodeData.routing?.rip || { enabled: false, networks: [], interfaces: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        rip: { ...rip, networks: (rip.networks || []).filter((n: string) => n !== net) },
      },
    });
  };

  // BGP
  const handleBgpToggle = () => {
    const bgp = nodeData.routing?.bgp || { enabled: false, asNumber: 65001, routerId: '', neighbors: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        bgp: { ...bgp, enabled: !bgp.enabled },
      },
    });
  };

  const handleBgpFieldChange = (field: string, value: any) => {
    const bgp = nodeData.routing?.bgp || { enabled: false, asNumber: 65001, routerId: '', neighbors: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        bgp: { ...bgp, [field]: value },
      },
    });
  };

  const handleAddBgpNeighbor = () => {
    if (!bgpNeighborIp || !bgpNeighborAs) return;
    const asNum = parseInt(bgpNeighborAs, 10);
    if (isNaN(asNum)) return;

    const bgp = nodeData.routing?.bgp || { enabled: false, asNumber: 65001, routerId: '', neighbors: [] };
    const neighbors = bgp.neighbors || [];
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        bgp: {
          ...bgp,
          neighbors: [...neighbors, { ipAddress: bgpNeighborIp, remoteAs: asNum }],
        },
      },
    });
    setBgpNeighborIp('');
    setBgpNeighborAs('');
  };

  const handleRemoveBgpNeighbor = (ip: string) => {
    const bgp = nodeData.routing?.bgp || { enabled: false, asNumber: 65001, routerId: '', neighbors: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        bgp: {
          ...bgp,
          neighbors: (bgp.neighbors || []).filter((n: any) => n.ipAddress !== ip),
        },
      },
    });
  };

  // Static Route
  const handleAddStaticRoute = () => {
    if (!staticDest || !staticNextHop) return;
    const current = nodeData.staticRoutes || [];
    updateNodeData(selectedNode.id, {
      staticRoutes: [...current, { destination: staticDest, nextHop: staticNextHop }],
    });
    setStaticDest('');
    setStaticNextHop('');
  };

  const handleRemoveStaticRoute = (dest: string) => {
    const current = nodeData.staticRoutes || [];
    updateNodeData(selectedNode.id, {
      staticRoutes: current.filter((r: any) => r.destination !== dest),
    });
  };

  // --- ホスト用ハンドラ ---
  const handleHostFieldChange = (field: string, value: string) => {
    updateNodeData(selectedNode.id, { [field]: value });
  };

  const isSwitch = selectedNode.type === 'switch';
  const nodeType = selectedNode.type || 'router';

  return (
    <div className="property-panel" data-testid="property-panel-node">
      <div className="panel-header">
        <div className="title-wrapper">
          <span className={`node-badge ${nodeType}`}>
            {nodeType.toUpperCase()}
          </span>
          <h3>{nodeData.label || 'Node'}</h3>
        </div>
        <div className="header-actions">
          <button onClick={() => deleteNode(selectedNode.id)} className="delete-btn" title="ノード削除" data-testid="delete-node-btn">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          設定
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          ステータス
        </button>
      </div>

      <div className="panel-content scrollable">
        {activeTab === 'config' && (
          <div className="config-tab-content">
            {/* 基本設定 */}
            <section className="config-section">
              <h4>基本設定</h4>
              <div className="form-group">
                <label htmlFor="hostname-input">ホスト名</label>
                <input
                  id="hostname-input"
                  type="text"
                  value={nodeData.label || ''}
                  onChange={(e) => handleLabelChange(e.target.value)}
                />
              </div>
              <div className="form-group row">
                <label>稼働ステータス</label>
                <button
                  type="button"
                  className={`status-toggle-btn ${nodeData.status === 'up' ? 'up' : 'down'}`}
                  onClick={handleStatusToggle}
                >
                  {nodeData.status === 'up' ? 'Running (UP)' : 'Stopped (DOWN)'}
                </button>
              </div>
            </section>
            {/* インターフェース設定 */}
            <section className="config-section">
              <h4>インターフェース設定</h4>
              {isSwitch ? (
                // スイッチの物理ポート
                <div className="interfaces-list">
                  {(nodeData.interfaces || []).map((iface: any, idx: number) => (
                    <div className="interface-row-switch" key={iface.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="interface-name" style={{ fontWeight: 'bold' }}>{iface.name}</span>
                        <button 
                          type="button" 
                          onClick={() => deletePort(selectedNode.id, iface.name)}
                          className="delete-port-btn" 
                          title="ポート削除"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px' }}>モード:</label>
                        <select
                          value={iface.vlanMode || 'access'}
                          onChange={(e) => {
                            const updated = [...(nodeData.interfaces || [])];
                            updated[idx] = { ...updated[idx], vlanMode: e.target.value };
                            updateNodeData(selectedNode.id, { interfaces: updated });
                          }}
                          style={{ padding: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                        >
                          <option value="access">Access</option>
                          <option value="trunk">Trunk</option>
                        </select>

                        {iface.vlanMode === 'trunk' ? (
                          <>
                            <label style={{ fontSize: '12px' }}>VLANs:</label>
                            <input
                              type="text"
                              placeholder="e.g. 10,20"
                              value={vlanIdsInputs[iface.id] !== undefined ? vlanIdsInputs[iface.id] : (Array.isArray(iface.vlanIds) ? iface.vlanIds.join(',') : iface.vlanIds || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVlanIdsInputs(prev => ({ ...prev, [iface.id]: val }));
                                const ids = val.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n));
                                const updated = [...(nodeData.interfaces || [])];
                                updated[idx] = { ...updated[idx], vlanIds: ids };
                                updateNodeData(selectedNode.id, { interfaces: updated });
                              }}
                              style={{ flex: 1, padding: '4px' }}
                            />
                          </>
                        ) : (
                          <>
                            <label style={{ fontSize: '12px' }}>VLAN ID:</label>
                            <input
                              type="number"
                              placeholder="1"
                              min="1"
                              max="4094"
                              value={iface.vlanId !== undefined ? iface.vlanId : ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const updated = [...(nodeData.interfaces || [])];
                                updated[idx] = { ...updated[idx], vlanId: isNaN(val) ? undefined : val };
                                updateNodeData(selectedNode.id, { interfaces: updated });
                              }}
                              style={{ flex: 1, padding: '4px' }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => addPort(selectedNode.id)}
                    className="add-port-btn"
                  >
                    <Plus size={14} /> 物理ポートを追加
                  </button>
                </div>
              ) : isRouter ? (
                // ルーターの物理ポート
                <div className="interfaces-list">
                  {(nodeData.interfaces || []).map((iface: any, idx: number) => (
                    <div className="interface-row" key={iface.id}>
                      <span className="interface-name">{iface.name}</span>
                      <input
                        type="text"
                        placeholder="IPアドレス/CIDR (e.g. 192.168.1.1/24)"
                        value={interfaceInputs[iface.id] !== undefined ? interfaceInputs[iface.id] : (iface.ipAddress && iface.netmask ? `${iface.ipAddress}/${iface.netmask}` : iface.ipAddress || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInterfaceInputs(prev => ({ ...prev, [iface.id]: val }));
                          const parts = val.split('/');
                          const ip = parts[0] || '';
                          const mask = parts[1] || '';
                          handleInterfaceChange(idx, { ipAddress: ip, netmask: mask });
                        }}
                      />
                      <button 
                        type="button" 
                        onClick={() => deletePort(selectedNode.id, iface.name)}
                        className="delete-port-btn" 
                        title="ポート削除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => addPort(selectedNode.id)}
                    className="add-port-btn"
                  >
                    <Plus size={14} /> 物理ポートを追加
                  </button>
                </div>
              ) : (
                // ホストのネットワーク設定
                <>
                  <div className="form-group">
                    <label htmlFor="host-ip">IPアドレス/CIDR</label>
                    <input
                      id="host-ip"
                      type="text"
                      placeholder="e.g. 192.168.1.10/24"
                      value={nodeData.ipAddress || ''}
                      onChange={(e) => handleHostFieldChange('ipAddress', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="host-gateway">デフォルトゲートウェイ</label>
                    <input
                      id="host-gateway"
                      type="text"
                      placeholder="e.g. 192.168.1.1"
                      value={nodeData.gateway || ''}
                      onChange={(e) => handleHostFieldChange('gateway', e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* VLAN / サブインターフェース */}
              {!isSwitch && (
                <div className="vlan-section">
                  <h5>VLAN サブインターフェース</h5>
                  <div className="vlan-add-form">
                    <select value={vlanParent} onChange={(e) => setVlanParent(e.target.value)}>
                      {isRouter ? (
                        (nodeData.interfaces || []).map((i: any) => (
                          <option key={i.id} value={i.name}>{i.name}</option>
                        ))
                      ) : (
                        <option value="eth1">eth1</option>
                      )}
                    </select>
                    <input
                      type="number"
                      placeholder="VLAN ID (1-4094)"
                      min="1"
                      max="4094"
                      value={vlanIdInput}
                      onChange={(e) => setVlanIdInput(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="IP/CIDR (e.g. 10.1.1.1/24)"
                      value={vlanIpInput}
                      onChange={(e) => setVlanIpInput(e.target.value)}
                    />
                    <button type="button" onClick={handleAddVlan} className="icon-btn-add">
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="vlan-list">
                    {(nodeData.vlanInterfaces || []).map((vlan: VlanInterfaceData, idx: number) => (
                      <div className="vlan-row" key={idx}>
                        <select
                          value={vlan.parentInterface}
                          onChange={(e) => handleVlanFieldChange(idx, 'parentInterface', e.target.value)}
                        >
                          {isRouter ? (
                            (nodeData.interfaces || []).map((i: any) => (
                              <option key={i.id} value={i.name}>{i.name}</option>
                            ))
                          ) : (
                            <option value="eth1">eth1</option>
                          )}
                        </select>
                        <input
                          type="number"
                          placeholder="VLAN ID"
                          min="1"
                          max="4094"
                          value={vlanIdInputs[idx] !== undefined ? vlanIdInputs[idx] : vlan.vlanId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVlanIdInputs(prev => ({ ...prev, [idx]: val }));
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4094) {
                              handleVlanFieldChange(idx, 'vlanId', parsed);
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            const parsed = parseInt(val, 10);
                            if (isNaN(parsed) || parsed < 1 || parsed > 4094) {
                              setVlanIdInputs(prev => ({ ...prev, [idx]: String(vlan.vlanId) }));
                            }
                          }}
                        />
                        <input
                          type="text"
                          placeholder="IPアドレス/CIDR"
                          value={vlanIpInputs[idx] !== undefined ? vlanIpInputs[idx] : vlan.ipAddress}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVlanIpInputs(prev => ({ ...prev, [idx]: val }));
                            handleVlanFieldChange(idx, 'ipAddress', val);
                          }}
                        />
                        <button type="button" onClick={() => handleRemoveVlan(vlan.name)} className="icon-btn-remove" title="削除">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ルーティング・スタティック設定（ルーターのみ） */}
            {isRouter && (
              <>
                {/* OSPF */}
                <section className="config-section">
                  <div className="section-title-toggle">
                    <h4>OSPF 設定</h4>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={nodeData.routing?.ospf?.enabled || false}
                        onChange={handleOspfToggle}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  {nodeData.routing?.ospf?.enabled && (
                    <div className="sub-config fade-in">
                      <div className="form-group">
                        <label htmlFor="ospf-router-id">ルーターID</label>
                        <input
                          id="ospf-router-id"
                          type="text"
                          placeholder="e.g. 1.1.1.1"
                          value={nodeData.routing?.ospf?.routerId || ''}
                          onChange={(e) => handleOspfFieldChange('routerId', e.target.value)}
                        />
                      </div>

                      {/* エリア管理セクション */}
                      <div className="vlan-section">
                        <h5>エリア設定 (ABR)</h5>
                        <div className="vlan-add-form">
                          <input
                            type="text"
                            placeholder="エリアID (e.g. 0.0.0.0)"
                            value={newAreaIdInput}
                            onChange={(e) => setNewAreaIdInput(e.target.value)}
                          />
                          <button type="button" onClick={handleAddOspfArea} className="icon-btn-add" data-testid="add-area-btn">
                            <Plus size={14} />
                          </button>
                        </div>
                        
                        <div className="area-list" style={{ marginTop: '10px' }}>
                          {(nodeData.routing?.ospf?.areas || []).map((area: any) => {
                            const areaColor = getAreaColor(area.areaId);
                            return (
                              <div key={area.areaId} className="area-card" data-testid={`area-card-${area.areaId}`} style={{
                                borderLeft: `4px solid ${areaColor}`
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <strong style={{ fontSize: '14px', color: areaColor }}>エリア: {area.areaId}</strong>
                                  <button type="button" onClick={() => handleRemoveOspfArea(area.areaId)} className="icon-btn-remove" data-testid={`remove-area-${area.areaId}`} style={{ padding: '2px' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                  <label style={{ fontSize: '12px' }}>エリアタイプ</label>
                                  <select
                                    value={area.areaType || 'normal'}
                                    onChange={(e) => handleOspfAreaFieldChange(area.areaId, 'areaType', e.target.value)}
                                    data-testid={`area-type-select-${area.areaId}`}
                                    style={{ width: '100%', padding: '6px' }}
                                  >
                                    <option value="normal">Normal</option>
                                    <option value="stub">Stub</option>
                                    <option value="totally-stub">Totally Stubby</option>
                                    <option value="nssa">NSSA</option>
                                    <option value="totally-nssa">Totally NSSA</option>
                                  </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                  <label style={{ fontSize: '12px' }}>所属インターフェース</label>
                                  <div className="checkbox-group">
                                    {/* 物理インターフェース */}
                                    {(nodeData.interfaces || []).map((i: any) => (
                                      <label className="checkbox-label" key={i.id} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                          type="checkbox"
                                          checked={area.interfaces?.includes(i.name) || false}
                                          onChange={() => handleOspfAreaInterfaceToggle(area.areaId, i.name)}
                                          data-testid={`area-${area.areaId}-iface-${i.name}`}
                                        />
                                        {i.name}
                                      </label>
                                    ))}
                                    {/* VLANインターフェース */}
                                    {(nodeData.vlanInterfaces || []).map((v: any) => (
                                      <label className="checkbox-label" key={v.name} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                          type="checkbox"
                                          checked={area.interfaces?.includes(v.name) || false}
                                          onChange={() => handleOspfAreaInterfaceToggle(area.areaId, v.name)}
                                          data-testid={`area-${area.areaId}-iface-${v.name}`}
                                        />
                                        {v.name}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '0' }}>
                                  <label style={{ fontSize: '12px' }}>ルート集約 (Area Range)</label>
                                  <div className="vlan-add-form" style={{ display: 'flex', gap: '4px' }}>
                                    <input
                                      type="text"
                                      placeholder="e.g. 10.0.0.0/24"
                                      value={areaRangeInputs[area.areaId] || ''}
                                      onChange={(e) => setAreaRangeInputs({ ...areaRangeInputs, [area.areaId]: e.target.value })}
                                      data-testid={`area-${area.areaId}-range-input`}
                                      style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                                    />
                                    <button type="button" onClick={() => handleAddOspfAreaRange(area.areaId)} className="icon-btn-add" data-testid={`area-${area.areaId}-add-range-btn`} style={{ padding: '4px' }}>
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                  <div className="network-list" style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {(area.ranges || []).map((range: string) => (
                                      <div key={range} className="vlan-row">
                                        <span>{range}</span>
                                        <button type="button" onClick={() => handleRemoveOspfAreaRange(area.areaId, range)} className="icon-btn-remove" data-testid={`area-${area.areaId}-remove-range-${range}`} style={{ padding: '2px' }}>
                                          <X size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* OSPF デフォルトルート広告 */}
                      <div className="vlan-section" style={{ marginTop: '12px' }}>
                        <h5>デフォルトルート広告</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0' }}>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.ospf?.defaultInformationOriginate?.enabled || false}
                              onChange={handleOspfDefaultRouteToggle}
                              data-testid="ospf-default-route-enable"
                            />
                            デフォルトルートを広報する
                          </label>
                          {nodeData.routing?.ospf?.defaultInformationOriginate?.enabled && (
                            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px' }}>
                              <input
                                type="checkbox"
                                checked={nodeData.routing?.ospf?.defaultInformationOriginate?.always || false}
                                onChange={handleOspfDefaultRouteAlwaysToggle}
                                data-testid="ospf-default-route-always"
                              />
                              常に広報する (always)
                            </label>
                          )}
                        </div>
                      </div>

                      {/* 再配送設定 */}
                      <div className="vlan-section" style={{ marginTop: '12px' }}>
                        <h5>OSPF ルート再配送設定</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '6px 0' }}>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.ospf?.redistribute?.connected || false}
                              onChange={() => handleRedistributeToggle('ospf', 'connected')}
                              data-testid="ospf-redistribute-connected"
                            />
                            直結ルート (Connected)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.ospf?.redistribute?.static || false}
                              onChange={() => handleRedistributeToggle('ospf', 'static')}
                              data-testid="ospf-redistribute-static"
                            />
                            静的ルート (Static)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.ospf?.redistribute?.rip || false}
                              onChange={() => handleRedistributeToggle('ospf', 'rip')}
                              data-testid="ospf-redistribute-rip"
                            />
                            RIP
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.ospf?.redistribute?.bgp || false}
                              onChange={() => handleRedistributeToggle('ospf', 'bgp')}
                              data-testid="ospf-redistribute-bgp"
                            />
                            BGP
                          </label>
                        </div>
                      </div>

                    </div>
                  )}
                </section>

                {/* RIP */}
                <section className="config-section">
                  <div className="section-title-toggle">
                    <h4>RIP 設定</h4>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={nodeData.routing?.rip?.enabled || false}
                        onChange={handleRipToggle}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  {nodeData.routing?.rip?.enabled && (
                    <div className="sub-config fade-in">
                      <div className="form-group">
                        <label>RIP ネットワーク範囲の追加</label>
                        <div className="vlan-add-form">
                          <input
                            type="text"
                            placeholder="e.g. 192.168.1.0/24"
                            value={ripNetworkInput}
                            onChange={(e) => setRipNetworkInput(e.target.value)}
                          />
                          <button type="button" onClick={handleAddRipNetwork} className="icon-btn-add">
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="network-list">
                        {(nodeData.routing?.rip?.networks || []).map((net: string) => (
                          <div className="vlan-row" key={net}>
                            <span>{net}</span>
                            <button type="button" onClick={() => handleRemoveRipNetwork(net)} className="icon-btn-remove">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* 再配送設定 */}
                      <div className="vlan-section" style={{ marginTop: '12px' }}>
                        <h5>RIP ルート再配送設定</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '6px 0' }}>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.rip?.redistribute?.connected || false}
                              onChange={() => handleRedistributeToggle('rip', 'connected')}
                              data-testid="rip-redistribute-connected"
                            />
                            直結ルート (Connected)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.rip?.redistribute?.static || false}
                              onChange={() => handleRedistributeToggle('rip', 'static')}
                              data-testid="rip-redistribute-static"
                            />
                            静的ルート (Static)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.rip?.redistribute?.ospf || false}
                              onChange={() => handleRedistributeToggle('rip', 'ospf')}
                              data-testid="rip-redistribute-ospf"
                            />
                            OSPF
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.rip?.redistribute?.bgp || false}
                              onChange={() => handleRedistributeToggle('rip', 'bgp')}
                              data-testid="rip-redistribute-bgp"
                            />
                            BGP
                          </label>
                        </div>
                      </div>

                    </div>
                  )}
                </section>

                {/* BGP */}
                <section className="config-section">
                  <div className="section-title-toggle">
                    <h4>BGP 設定</h4>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={nodeData.routing?.bgp?.enabled || false}
                        onChange={handleBgpToggle}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  {nodeData.routing?.bgp?.enabled && (
                    <div className="sub-config fade-in">
                      <div className="form-group">
                        <label htmlFor="bgp-as-num">自 AS 番号</label>
                        <input
                          id="bgp-as-num"
                          type="number"
                          placeholder="e.g. 65001"
                          value={nodeData.routing?.bgp?.asNumber || ''}
                          onChange={(e) => handleBgpFieldChange('asNumber', parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bgp-router-id">ルーターID</label>
                        <input
                          id="bgp-router-id"
                          type="text"
                          placeholder="e.g. 1.1.1.1"
                          value={nodeData.routing?.bgp?.routerId || ''}
                          onChange={(e) => handleBgpFieldChange('routerId', e.target.value)}
                        />
                      </div>
                      
                      <div className="vlan-section">
                        <h5>BGP ネイバー設定</h5>
                        <div className="vlan-add-form">
                          <input
                            type="text"
                            placeholder="ネイバーIP (e.g. 10.10.10.2)"
                            value={bgpNeighborIp}
                            onChange={(e) => setBgpNeighborIp(e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="リモートAS"
                            value={bgpNeighborAs}
                            onChange={(e) => setBgpNeighborAs(e.target.value)}
                          />
                          <button type="button" onClick={handleAddBgpNeighbor} className="icon-btn-add">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="vlan-list">
                          {(nodeData.routing?.bgp?.neighbors || []).map((n: any) => (
                            <div className="vlan-row" key={n.ipAddress}>
                              <span>{n.ipAddress} (AS {n.remoteAs})</span>
                              <button type="button" onClick={() => handleRemoveBgpNeighbor(n.ipAddress)} className="icon-btn-remove">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 再配送設定 */}
                      <div className="vlan-section" style={{ marginTop: '12px' }}>
                        <h5>BGP ルート再配送設定</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '6px 0' }}>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.bgp?.redistribute?.connected || false}
                              onChange={() => handleRedistributeToggle('bgp', 'connected')}
                              data-testid="bgp-redistribute-connected"
                            />
                            直結ルート (Connected)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.bgp?.redistribute?.static || false}
                              onChange={() => handleRedistributeToggle('bgp', 'static')}
                              data-testid="bgp-redistribute-static"
                            />
                            静的ルート (Static)
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.bgp?.redistribute?.ospf || false}
                              onChange={() => handleRedistributeToggle('bgp', 'ospf')}
                              data-testid="bgp-redistribute-ospf"
                            />
                            OSPF
                          </label>
                          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={nodeData.routing?.bgp?.redistribute?.rip || false}
                              onChange={() => handleRedistributeToggle('bgp', 'rip')}
                              data-testid="bgp-redistribute-rip"
                            />
                            RIP
                          </label>
                        </div>
                      </div>

                    </div>
                  )}
                </section>

                {/* Static Routes */}
                <section className="config-section">
                  <h4>スタティックルート設定</h4>
                  <div className="vlan-add-form">
                    <input
                      type="text"
                      placeholder="宛先 CIDR (e.g. 10.0.0.0/8)"
                      value={staticDest}
                      onChange={(e) => setStaticDest(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Next Hop"
                      value={staticNextHop}
                      onChange={(e) => setStaticNextHop(e.target.value)}
                    />
                    <button type="button" onClick={handleAddStaticRoute} className="icon-btn-add">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="vlan-list">
                    {(nodeData.staticRoutes || []).map((route: any) => (
                      <div className="vlan-row" key={route.destination}>
                        <span>{route.destination} via {route.nextHop}</span>
                        <button type="button" onClick={() => handleRemoveStaticRoute(route.destination)} className="icon-btn-remove">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="status-tab-content">
            <div className="status-controls">
              <select value={statusType} onChange={(e) => setStatusType(e.target.value)}>
                <option value="routing_table">ルーティングテーブル</option>
                <option value="arp_table">ARPテーブル</option>
                {isRouter && (
                  <>
                    <option value="ospf_neighbors">OSPF ネイバー</option>
                    <option value="bgp_neighbors">BGP ネイバー</option>
                    <option value="rip_status">RIP ステータス</option>
                  </>
                )}
              </select>
              <button
                type="button"
                className="refresh-btn"
                onClick={handleRefreshStatus}
                disabled={isLoadingStatus || nodeData.status !== 'up'}
                data-testid="refresh-status-btn"
              >
                <RefreshCw size={14} className={isLoadingStatus ? 'spin' : ''} />
                更新
              </button>
            </div>

            {nodeData.status !== 'up' && (
              <div className="status-warning">
                ノードが稼働していません。ステータス情報を取得するには、基本設定でステータスを Running に変更し、トポロジを適用してください。
              </div>
            )}

            <div className="cli-terminal-viewer mono-text" data-testid="cli-viewer">
              <pre>{statusOutput || '更新ボタンを押して最新のステータスを取得してください。'}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
