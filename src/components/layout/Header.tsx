import { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { applyTopology } from '../../api/client';
import { Play, Check, AlertTriangle, RefreshCw, FileJson } from 'lucide-react';
import JsonEditorModal from '../json/JsonEditorModal';
import './Header.css';

export default function Header() {
  const { nodes, edges } = useTopologyStore();
  const [isApplying, setIsApplying] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleApply = async () => {
    setIsApplying(true);
    
    const cleanHandle = (h: string | null | undefined) => h ? h.replace(/-(left|right)-(src|tgt)$/, '') : 'eth0';

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
          `${edge.source}:${cleanHandle(edge.sourceHandle)}`,
          `${edge.target}:${cleanHandle(edge.targetHandle)}`
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
          const ospfInterfaces = data.routing?.ospf?.interfaces || [];
          const ospfNetworks: string[] = [];
          
          (data.interfaces || []).forEach((i: any) => {
            if (ospfInterfaces.includes(i.name) && i.ipAddress && i.netmask) {
              ospfNetworks.push(`${i.ipAddress}/${i.netmask}`);
            }
          });
          (data.vlanInterfaces || []).forEach((v: any) => {
            if (ospfInterfaces.includes(v.name) && v.ipAddress) {
              ospfNetworks.push(v.ipAddress);
            }
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
                areas: [
                  {
                    area_id: data.routing?.ospf?.areaId || '0.0.0.0',
                    networks: ospfNetworks,
                  }
                ]
              },
              rip: {
                enabled: data.routing?.rip?.enabled || false,
                networks: data.routing?.rip?.networks || [],
              },
              bgp: {
                enabled: data.routing?.bgp?.enabled || false,
                as_number: Number(data.routing?.bgp?.asNumber || 65001),
                router_id: data.routing?.bgp?.routerId || '',
                neighbors: (data.routing?.bgp?.neighbors || []).map((n: any) => ({
                  ip_address: n.ipAddress,
                  remote_as: Number(n.remoteAs),
                })),
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
        <h1 className="header-title">Cybernet OS Network Simulator</h1>
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
          onClick={handleApply}
          disabled={isApplying}
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
