import { useState, useEffect } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import type { NetworkEdgeData, VlanInterfaceData } from '../../types/topology';
import { getNodeStatus } from '../../api/client';
import { Trash2, Plus, X, RefreshCw } from 'lucide-react';
import './PropertyPanel.css';

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
  const [vlanParent, setVlanParent] = useState<string>('eth0');
  const [vlanIdInput, setVlanIdInput] = useState<string>('');
  const [vlanIpInput, setVlanIpInput] = useState<string>('');

  // RIPネットワーク追加用
  const [ripNetworkInput, setRipNetworkInput] = useState<string>('');

  // BGPネイバー追加用
  const [bgpNeighborIp, setBgpNeighborIp] = useState<string>('');
  const [bgpNeighborAs, setBgpNeighborAs] = useState<string>('');

  // スタティックルート追加用
  const [staticDest, setStaticDest] = useState<string>('');
  const [staticNextHop, setStaticNextHop] = useState<string>('');

  // 選択中の要素を取得
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // 選択が変わったら出力をリセット
  useEffect(() => {
    setStatusOutput('');
  }, [selectedNodeId, statusType]);

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
  const handleInterfaceChange = (index: number, field: string, value: string) => {
    const updated = [...(nodeData.interfaces || [])];
    updated[index] = { ...updated[index], [field]: value };
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

  // OSPF
  const handleOspfToggle = () => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: { ...ospf, enabled: !ospf.enabled },
      },
    });
  };

  const handleOspfFieldChange = (field: string, value: any) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] };
    updateNodeData(selectedNode.id, {
      routing: {
        ...nodeData.routing,
        ospf: { ...ospf, [field]: value },
      },
    });
  };

  const handleOspfInterfaceToggle = (ifName: string) => {
    const ospf = nodeData.routing?.ospf || { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] };
    const interfaces = ospf.interfaces || [];
    const updated = interfaces.includes(ifName)
      ? interfaces.filter((i: string) => i !== ifName)
      : [...interfaces, ifName];
    handleOspfFieldChange('interfaces', updated);
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

  return (
    <div className="property-panel" data-testid="property-panel-node">
      <div className="panel-header">
        <div className="title-wrapper">
          <span className={`node-badge ${isRouter ? 'router' : 'host'}`}>
            {isRouter ? 'ROUTER' : 'HOST'}
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
              {isRouter ? (
                // ルーターの物理ポート
                <div className="interfaces-list">
                  {(nodeData.interfaces || []).map((iface: any, idx: number) => (
                    <div className="interface-row" key={iface.id}>
                      <span className="interface-name">{iface.name}</span>
                      <input
                        type="text"
                        placeholder="IPアドレス/CIDR (e.g. 192.168.1.1/24)"
                        value={iface.ipAddress && iface.netmask ? `${iface.ipAddress}/${iface.netmask}` : iface.ipAddress || ''}
                        onChange={(e) => {
                          const parts = e.target.value.split('/');
                          const ip = parts[0] || '';
                          const mask = parts[1] || '';
                          handleInterfaceChange(idx, 'ipAddress', ip);
                          handleInterfaceChange(idx, 'netmask', mask);
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
              <div className="vlan-section">
                <h5>VLAN サブインターフェース</h5>
                <div className="vlan-add-form">
                  <select value={vlanParent} onChange={(e) => setVlanParent(e.target.value)}>
                    {isRouter ? (
                      (nodeData.interfaces || []).map((i: any) => (
                        <option key={i.id} value={i.name}>{i.name}</option>
                      ))
                    ) : (
                      <option value="eth0">eth0</option>
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
                  {(nodeData.vlanInterfaces || []).map((vlan: VlanInterfaceData) => (
                    <div className="vlan-row" key={vlan.name}>
                      <span className="vlan-name">{vlan.name}</span>
                      <span className="vlan-ip">{vlan.ipAddress}</span>
                      <button type="button" onClick={() => handleRemoveVlan(vlan.name)} className="icon-btn-remove">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
                      <div className="form-group">
                        <label htmlFor="ospf-area-id">エリアID</label>
                        <input
                          id="ospf-area-id"
                          type="text"
                          placeholder="e.g. 0.0.0.0"
                          value={nodeData.routing?.ospf?.areaId || ''}
                          onChange={(e) => handleOspfFieldChange('areaId', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>対象インターフェース</label>
                        <div className="checkbox-group">
                          {/* 物理インターフェース */}
                          {(nodeData.interfaces || []).map((i: any) => (
                            <label className="checkbox-label" key={i.id}>
                              <input
                                type="checkbox"
                                checked={nodeData.routing?.ospf?.interfaces?.includes(i.name) || false}
                                onChange={() => handleOspfInterfaceToggle(i.name)}
                              />
                              {i.name}
                            </label>
                          ))}
                          {/* VLANインターフェース */}
                          {(nodeData.vlanInterfaces || []).map((v: any) => (
                            <label className="checkbox-label" key={v.name}>
                              <input
                                type="checkbox"
                                checked={nodeData.routing?.ospf?.interfaces?.includes(v.name) || false}
                                onChange={() => handleOspfInterfaceToggle(v.name)}
                              />
                              {v.name}
                            </label>
                          ))}
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
