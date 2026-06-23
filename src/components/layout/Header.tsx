import React, { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { applyTopology } from '../../api/client';
import { Play, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import './Header.css';

export default function Header() {
  const { nodes, edges } = useTopologyStore();
  const [isApplying, setIsApplying] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleApply = async () => {
    setIsApplying(true);
    
    // トポロジペイロードのビルド
    const formattedNodes = nodes.map(node => {
      if (node.type === 'router') {
        const data = node.data;
        const ospfInterfaces = data.routing?.ospf?.interfaces || [];
        const ospfNetworks: string[] = [];
        
        // 物理IPをOSPFネットワークに
        (data.interfaces || []).forEach((i: any) => {
          if (ospfInterfaces.includes(i.name) && i.ipAddress && i.netmask) {
            ospfNetworks.push(`${i.ipAddress}/${i.netmask}`);
          }
        });
        // VLAN IPをOSPFネットワークに
        (data.vlanInterfaces || []).forEach((v: any) => {
          if (ospfInterfaces.includes(v.name) && v.ipAddress) {
            ospfNetworks.push(v.ipAddress);
          }
        });

        return {
          id: node.id,
          type: 'router',
          hostname: data.label,
          interfaces: (data.interfaces || [])
            .filter((i: any) => i.ipAddress)
            .map((i: any) => ({
              name: i.name,
              ip_address: `${i.ipAddress}/${i.netmask}`,
            })),
          vlan_interfaces: (data.vlanInterfaces || []).map((v: any) => ({
            name: v.name,
            parent_interface: v.parentInterface,
            vlan_id: v.vlanId,
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
              as_number: data.routing?.bgp?.asNumber || 65001,
              router_id: data.routing?.bgp?.routerId || '',
              neighbors: (data.routing?.bgp?.neighbors || []).map((n: any) => ({
                ip_address: n.ipAddress,
                remote_as: n.remoteAs,
              })),
            }
          },
          static_routes: (data.staticRoutes || []).map((r: any) => ({
            destination: r.destination,
            next_hop: r.nextHop,
          })),
        };
      } else {
        const data = node.data;
        return {
          id: node.id,
          type: 'host',
          hostname: data.label,
          interfaces: data.ipAddress ? [
            {
              name: 'eth0',
              ip_address: data.ipAddress,
              gateway: data.gateway || undefined,
            }
          ] : [],
          vlan_interfaces: (data.vlanInterfaces || []).map((v: any) => ({
            name: v.name,
            parent_interface: v.parentInterface,
            vlan_id: v.vlanId,
            ip_address: v.ipAddress,
          })),
        };
      }
    });

    const formattedLinks = edges.map(edge => ({
      id: edge.id,
      source_node: edge.source,
      source_interface: edge.sourceHandle || 'eth0',
      target_node: edge.target,
      target_interface: edge.targetHandle || 'eth0',
    }));

    const payload = {
      topology_id: `topo-${Date.now()}`,
      nodes: formattedNodes,
      links: formattedLinks,
    };

    try {
      const result = await applyTopology(payload);
      if (result.success) {
        showToast('success', 'トポロジを適用しました。');
      } else {
        showToast('error', `適用の失敗: ${result.message}`);
      }
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
    </header>
  );
}
