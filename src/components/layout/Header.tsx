import { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { applyTopology } from '../../api/client';
import { Play, Check, AlertTriangle, RefreshCw, FileJson, Trash2, RotateCcw } from 'lucide-react';
import JsonEditorModal from '../json/JsonEditorModal';
import './Header.css';

export default function Header() {
  const { nodes, edges, hasChanges, saveState, resetTopologyState } = useTopologyStore();
  const [isApplying, setIsApplying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingTopology, setIsResettingTopology] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleResetTopology = async () => {
    if (!confirm('警告: トポロジの構成を初期状態（デフォルト）に戻します。構築済みの環境も破棄されます。よろしいですか？')) {
      return;
    }
    setIsResettingTopology(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      await fetch(`${API_BASE_URL}/topology/destroy`, {
        method: 'POST',
      });
      
      await resetTopologyState();
      
      showToast('success', 'トポロジを初期状態にリセットしました。');
    } catch (err: any) {
      showToast('error', `リセットの失敗: ${err.message || err}`);
    } finally {
      setIsResettingTopology(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('警告: 構築済みのすべてのコンテナを停止・削除し、初期状態に戻します。よろしいですか？')) {
      return;
    }
    setIsResetting(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/topology/destroy`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('リセットに失敗しました。');
      }

      nodes.forEach(n => {
        useTopologyStore.getState().updateNodeData(n.id, { status: 'down' });
      });

      showToast('success', '環境をリセットしました。');
    } catch (err: any) {
      showToast('error', `リセットの失敗: ${err.message || err}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    
    const cleanHandle = (h: string | null | undefined) => h ? h.replace(/-(left|right)-(src|tgt)$/, '') : 'eth1';

    // 1. Build and Deploy Topology Payload
    const deployPayload = {
      name: "sim-network",
      nodes: nodes.map(node => ({
        name: node.id,
        type: node.type === 'host' ? 'terminal' : node.type,
        interfaces: node.type === 'switch' || node.type === 'router'
          ? (node.data.interfaces || []).map((i: any) => i.name)
          : ['eth1']
      })),
      links: edges.map(edge => ({
        endpoints: [
          `${edge.source}:${edge.data?.sourceInterface || cleanHandle(edge.sourceHandle)}`,
          `${edge.target}:${edge.data?.targetInterface || cleanHandle(edge.targetHandle)}`
        ]
      }))
    };

    try {
      // 2. Deploy Topology
      const deployResult = await applyTopology(deployPayload);
      const isSuccess = (deployResult as any).status === 'success' || deployResult.success;
      if (!isSuccess) {
        showToast('error', `トポロジの適用に失敗しました: ${deployResult.message}`);
        setIsApplying(false);
        return;
      }

      // Wait a short moment for containerlab to initialize daemons inside containers before configuring them
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 3. Configure each node
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

      for (const node of nodes) {
        let configPayload: any = {};

        if (node.type === 'router') {
          const data = node.data;
          const areas = (data.routing?.ospf?.areas || []).map((area: any) => {
            const areaNetworks: string[] = [];
            (area.interfaces || []).forEach((ifaceName: string) => {
              const foundIface = (data.interfaces || []).find((i: any) => i.name === ifaceName);
              if (foundIface && foundIface.ipAddress && foundIface.netmask) {
                areaNetworks.push(`${foundIface.ipAddress}/${foundIface.netmask}`);
              }
              const foundVlanIface = (data.vlanInterfaces || []).find((v: any) => v.name === ifaceName);
              if (foundVlanIface && foundVlanIface.ipAddress) {
                areaNetworks.push(foundVlanIface.ipAddress);
              }
            });
            return {
              area_id: area.areaId || '0.0.0.0',
              networks: areaNetworks,
              interfaces: area.interfaces || [],
              ranges: area.ranges || [],
              area_type: area.areaType || 'normal'
            };
          });

          configPayload = {
            interfaces: (data.interfaces || [])
              .filter((i: any) => i.ipAddress)
              .map((i: any) => ({
                name: i.name,
                ip_address: `${i.ipAddress}/${i.netmask}`,
              })),
            vlan_interfaces: (data.vlanInterfaces || []).map((v: any) => ({
              name: v.name,
              parent: v.parentInterface,
              vlan_id: Number(v.vlanId),
              ip_address: v.ipAddress,
            })),
            routing: {
              ospf: {
                enabled: data.routing?.ospf?.enabled || false,
                router_id: data.routing?.ospf?.routerId || '',
                areas: areas,
                redistribute: data.routing?.ospf?.redistribute || {},
                default_information_originate: data.routing?.ospf?.defaultInformationOriginate || { enabled: false }
              },
              rip: {
                enabled: data.routing?.rip?.enabled || false,
                networks: data.routing?.rip?.networks || [],
                redistribute: data.routing?.rip?.redistribute || {},
              },
              bgp: {
                enabled: data.routing?.bgp?.enabled || false,
                as_number: Number(data.routing?.bgp?.asNumber || 65001),
                router_id: data.routing?.bgp?.routerId || '',
                neighbors: (data.routing?.bgp?.neighbors || []).map((n: any) => ({
                  ip_address: n.ipAddress,
                  remote_as: Number(n.remoteAs),
                })),
                redistribute: data.routing?.bgp?.redistribute || {},
              }
            },
            static_routes: (data.staticRoutes || []).map((r: any) => ({
              destination: r.destination,
              next_hop: r.nextHop,
            })),
          };
        } else if (node.type === 'switch') {
          const data = node.data;
          configPayload = {
            interfaces: (data.interfaces || []).map((i: any) => ({
              name: i.name,
              vlan_mode: i.vlanMode || 'none',
              vlan_id: i.vlanMode === 'access' ? Number(i.vlanId) : undefined,
              vlan_ids: i.vlanMode === 'trunk' ? (Array.isArray(i.vlanIds) ? i.vlanIds : String(i.vlanIds || '').split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))) : undefined,
            })),
            vlan_interfaces: [],
            routing: null
          };
        } else {
          const data = node.data;
          configPayload = {
            interfaces: data.ipAddress ? [
              {
                name: 'eth1',
                ip_address: data.ipAddress,
              }
            ] : [],
            vlan_interfaces: [],
            routing: null,
            gateway: data.gateway || undefined
          };
        }

        const response = await fetch(`${API_BASE_URL}/nodes/${node.id}/configure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${node.data.label || node.id} の設定適用に失敗しました: ${errorData.detail || 'Error'}`);
        }
      }

      // Update node statuses to 'up' in UI state
      nodes.forEach(n => {
        useTopologyStore.getState().updateNodeData(n.id, { status: 'up' });
      });

      // Save as deployed state to clear change indicator
      await saveState(true);

      showToast('success', 'トポロジを適用しました。');
    } catch (err: any) {
      showToast('error', `適用の失敗: ${err.message || err}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <header className="app-header" data-testid="app-header">
      <div className="header-brand">
        <div className="title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 className="header-title">Cybernet OS Network Simulator</h1>
          {hasChanges && (
            <span className="unsaved-badge" data-testid="unsaved-badge">
              <AlertTriangle size={12} />
              未適用
            </span>
          )}
        </div>
        <span className="header-subtitle">Container-based Topology Lab</span>
      </div>

      <div className="header-actions">
        <button
          type="button"
          onClick={() => setIsJsonModalOpen(true)}
          className="json-button"
          data-testid="json-edit-btn"
          title="JSON構成の表示・インポート"
        >
          <FileJson size={16} />
          JSON編集
        </button>
        <button
          type="button"
          onClick={handleResetTopology}
          disabled={isResettingTopology || isApplying || isResetting}
          className={`reset-topology-button ${isResettingTopology ? 'resetting' : ''}`}
          data-testid="reset-topology-btn"
          title="トポロジの初期化 (デフォルト状態に戻す)"
        >
          {isResettingTopology ? (
            <>
              <RefreshCw size={16} className="spin-icon" />
              初期化中...
            </>
          ) : (
            <>
              <RotateCcw size={16} />
              トポロジ初期化
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting || isApplying || isResettingTopology}
          className={`reset-button ${isResetting ? 'resetting' : ''}`}
          data-testid="reset-btn"
          title="コンテナの停止と削除"
        >
          {isResetting ? (
            <>
              <RefreshCw size={16} className="spin-icon" />
              リセット中...
            </>
          ) : (
            <>
              <Trash2 size={16} />
              環境リセット
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={isApplying || isResetting}
          className={`apply-button ${isApplying ? 'applying' : ''}`}
          data-testid="apply-btn"
        >
          {isApplying ? (
            <>
              <RefreshCw size={16} className="spin-icon" />
              適用中...
            </>
          ) : (
            <>
              <Play size={16} />
              適用
            </>
          )}
        </button>
      </div>

      {toast && (
        <div className={`toast-notification ${toast.type} fade-in`} data-testid="toast-notification">
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <JsonEditorModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} />
    </header>
  );
}
