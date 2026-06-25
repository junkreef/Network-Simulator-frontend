import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import App from '../src/App';
import { useTopologyStore } from '../src/store/topologyStore';
import { server } from './mocks/server';

beforeAll(() => {
  server.listen();
});

let setTimeoutSpy: any;

beforeEach(() => {
  const realSetTimeout = global.setTimeout;
  setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb: any, ms?: number) => {
    if (ms === 10000) {
      cb();
    } else {
      realSetTimeout(cb, ms || 0);
    }
    return 0 as any;
  });
});

afterEach(() => {
  server.resetHandlers();
  if (setTimeoutSpy) {
    setTimeoutSpy.mockRestore();
  }
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});

describe('Topology Apply Integration Flow', () => {
  it('適用ボタン押下時に正しいスキーマでAPIリクエストが送られ、成功トーストが表示されること', async () => {
    useTopologyStore.setState({
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'R1',
            status: 'down',
            interfaces: [
              { id: 'eth0', name: 'eth0', ipAddress: '192.168.1.1', netmask: '24' },
            ],
            vlanInterfaces: [],
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
              },
            },
            staticRoutes: [],
          },
        },
      ],
      edges: [],
    });

    render(<App />);

    const applyButton = screen.getByRole('button', { name: /適用/i });
    expect(applyButton).toBeInTheDocument();

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText('トポロジを適用しました。')).toBeInTheDocument();
    });
  });

  it('OSPF, BGP, 静的ルーティング（Static Routes）が設定されたルーターの適用JSONが正しいこと', async () => {
    let lastDeployBody: any = null;
    let lastConfigureBody: any = null;

    server.use(
      http.post('/api/v1/topology/deploy', async ({ request }) => {
        lastDeployBody = await request.json();
        return HttpResponse.json({ success: true, message: 'Applied successfully' });
      }),
      http.post('/api/v1/nodes/:id/configure', async ({ request }) => {
        lastConfigureBody = await request.json();
        return HttpResponse.json({ status: 'success' });
      })
    );

    useTopologyStore.setState({
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'R1',
            status: 'down',
            interfaces: [
              { id: 'eth0', name: 'eth0', ipAddress: '192.168.1.1', netmask: '24' },
            ],
            vlanInterfaces: [],
            routing: {
              ospf: {
                enabled: true,
                routerId: '1.1.1.1',
                areas: [
                  {
                    areaId: '0.0.0.0',
                    interfaces: ['eth0'],
                    ranges: ['192.168.0.0/16'],
                    areaType: 'normal'
                  }
                ],
                redistribute: { connected: true, static: true, rip: false, bgp: false },
                defaultInformationOriginate: { enabled: true, always: true }
              },
              rip: {
                enabled: true,
                networks: ['192.168.1.0/24'],
                redistribute: { connected: false, static: true, ospf: true, bgp: false }
              },
              bgp: {
                enabled: true,
                asNumber: 65001,
                routerId: '1.1.1.1',
                neighbors: [
                  { ipAddress: '192.168.1.2', remoteAs: 65002 }
                ],
                redistribute: { connected: true, static: false, ospf: false, rip: true }
              },
            },
            staticRoutes: [
              { destination: '10.0.0.0/24', nextHop: '192.168.1.254' }
            ],
          },
        },
      ],
      edges: [],
    });

    render(<App />);

    const applyButton = screen.getByRole('button', { name: /適用/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText('トポロジを適用しました。')).toBeInTheDocument();
    });

    expect(lastDeployBody).toBeDefined();
    expect(lastDeployBody.nodes[0].name).toBe('router-1');
    expect(lastDeployBody.nodes[0].type).toBe('router');

    expect(lastConfigureBody).toBeDefined();
    expect(lastConfigureBody.routing.ospf.enabled).toBe(true);
    expect(lastConfigureBody.routing.ospf.router_id).toBe('1.1.1.1');
    expect(lastConfigureBody.routing.ospf.areas[0].networks).toContain('192.168.1.1/24');
    expect(lastConfigureBody.routing.ospf.areas[0].ranges).toContain('192.168.0.0/16');
    expect(lastConfigureBody.routing.ospf.areas[0].area_type).toBe('normal');
    expect(lastConfigureBody.routing.ospf.redistribute.connected).toBe(true);
    expect(lastConfigureBody.routing.ospf.default_information_originate.enabled).toBe(true);
    expect(lastConfigureBody.routing.ospf.default_information_originate.always).toBe(true);

    expect(lastConfigureBody.routing.rip.enabled).toBe(true);
    expect(lastConfigureBody.routing.rip.networks).toContain('192.168.1.0/24');
    expect(lastConfigureBody.routing.rip.redistribute.static).toBe(true);

    expect(lastConfigureBody.routing.bgp.enabled).toBe(true);
    expect(lastConfigureBody.routing.bgp.as_number).toBe(65001);
    expect(lastConfigureBody.routing.bgp.neighbors[0].ip_address).toBe('192.168.1.2');
    expect(lastConfigureBody.routing.bgp.neighbors[0].remote_as).toBe(65002);
    expect(lastConfigureBody.routing.bgp.redistribute.connected).toBe(true);
    
    expect(lastConfigureBody.static_routes).toBeDefined();
    expect(lastConfigureBody.static_routes[0].destination).toBe('10.0.0.0/24');
    expect(lastConfigureBody.static_routes[0].next_hop).toBe('192.168.1.254');
  });

  it('未適用インジケーター（バッジ）がトポロジの変更に応じて表示・非表示になること', async () => {
    useTopologyStore.setState({
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: { label: 'R1', status: 'down' }
        }
      ],
      edges: [],
      deployedNodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: { label: 'R1', status: 'down' }
        }
      ],
      deployedEdges: [],
      hasChanges: false
    });

    render(<App />);

    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();

    useTopologyStore.getState().onNodesChange([
      {
        type: 'position',
        id: 'router-1',
        position: { x: 100, y: 100 }
      }
    ]);
    
    expect(useTopologyStore.getState().hasChanges).toBe(false);
    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();

    useTopologyStore.getState().updateNodeData('router-1', { label: 'New R1' });

    expect(useTopologyStore.getState().hasChanges).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    const applyButton = screen.getByRole('button', { name: /適用/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();
    });
    expect(useTopologyStore.getState().hasChanges).toBe(false);
  });
});
