import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReactFlowProvider } from 'reactflow';
import { RouterNode, HostNode } from '../src/features/topology/components/CustomNodes';
import { useTopologyStore } from '../src/store/topologyStore';

describe('CustomNodes Component', () => {
  it('RouterNodeがVLANインターフェイスを正しく表示すること', () => {
    useTopologyStore.setState({ edges: [] });

    const routerData = {
      label: 'Router-A',
      status: 'up' as const,
      interfaces: [
        { id: 'eth1', name: 'eth1', ipAddress: '10.1.0.2', netmask: '24' },
        { id: 'eth2', name: 'eth2', ipAddress: '', netmask: '' }
      ],
      vlanInterfaces: [
        { name: 'eth2.100', parentInterface: 'eth2', vlanId: 100, ipAddress: '10.1.100.1/24' },
        { name: 'eth2.101', parentInterface: 'eth2', vlanId: 101, ipAddress: '10.1.101.1/24' }
      ],
      routing: {
        ospf: {
          enabled: false,
          routerId: '',
          areas: [],
          redistribute: { connected: false, static: false, rip: false, bgp: false },
          defaultInformationOriginate: { enabled: false, always: false }
        },
        rip: {
          enabled: false,
          networks: [],
          redistribute: { connected: false, static: false, ospf: false, bgp: false }
        },
        bgp: {
          enabled: false,
          asNumber: 65001,
          routerId: '',
          neighbors: [],
          redistribute: { connected: false, static: false, ospf: false, rip: false }
        }
      },
      staticRoutes: []
    };

    render(
      <ReactFlowProvider>
        <RouterNode id="router-1" data={routerData} selected={false} dragging={false} zIndex={1} isConnectable={true} xPos={0} yPos={0} type="router" />
      </ReactFlowProvider>
    );

    // 親インターフェイスの表示検証
    expect(screen.getByText('eth1')).toBeInTheDocument();
    expect(screen.getByText('10.1.0.2/24')).toBeInTheDocument();
    expect(screen.getByText('eth2')).toBeInTheDocument();
    expect(screen.getByText('no IP')).toBeInTheDocument();

    // VLANインターフェイスの表示検証
    expect(screen.getByText('.100')).toBeInTheDocument();
    expect(screen.getByText('10.1.100.1/24')).toBeInTheDocument();
    expect(screen.getByText('.101')).toBeInTheDocument();
    expect(screen.getByText('10.1.101.1/24')).toBeInTheDocument();
  });

  it('HostNodeがVLANインターフェイスを正しく表示すること', () => {
    useTopologyStore.setState({ edges: [] });

    const hostData = {
      label: 'Host-A',
      status: 'up' as const,
      ipAddress: '192.168.1.10/24',
      gateway: '192.168.1.1',
      vlanInterfaces: [
        { name: 'eth1.50', parentInterface: 'eth1', vlanId: 50, ipAddress: '10.50.0.10/24' }
      ]
    };

    render(
      <ReactFlowProvider>
        <HostNode id="host-1" data={hostData} selected={false} dragging={false} zIndex={1} isConnectable={true} xPos={0} yPos={0} type="host" />
      </ReactFlowProvider>
    );

    expect(screen.getByText('eth1')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.10/24')).toBeInTheDocument();
    expect(screen.getByText('.50')).toBeInTheDocument();
    expect(screen.getByText('10.50.0.10/24')).toBeInTheDocument();
  });
});
