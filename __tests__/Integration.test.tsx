import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import App from '../src/App';
import { useTopologyStore } from '../src/store/topologyStore';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Topology Apply Integration Flow', () => {
  it('適用ボタン押下時に正しいスキーマでAPIリクエストが送られ、成功トーストが表示されること', async () => {
    // テスト用のトポロジデータをストアに流し込む
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
              ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
              rip: { enabled: false, networks: [], interfaces: [] },
              bgp: { enabled: false, asNumber: 65001, routerId: '', neighbors: [] },
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

    // 成功メッセージが表示されるまで待機
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
                areaId: '0.0.0.0',
                interfaces: ['eth0']
              },
              rip: { enabled: true, networks: ['192.168.1.0/24'], interfaces: [] },
              bgp: {
                enabled: true,
                asNumber: 65001,
                routerId: '1.1.1.1',
                neighbors: [
                  { ipAddress: '192.168.1.2', remoteAs: 65002 }
                ]
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

    // Deploy Body のアサート
    expect(lastDeployBody).toBeDefined();
    expect(lastDeployBody.nodes[0].name).toBe('router-1');
    expect(lastDeployBody.nodes[0].type).toBe('router');

    // Configure Body のアサート
    expect(lastConfigureBody).toBeDefined();
    expect(lastConfigureBody.routing.ospf.enabled).toBe(true);
    expect(lastConfigureBody.routing.ospf.router_id).toBe('1.1.1.1');
    expect(lastConfigureBody.routing.ospf.areas[0].networks).toContain('192.168.1.1/24');
    expect(lastConfigureBody.routing.bgp.enabled).toBe(true);
    expect(lastConfigureBody.routing.bgp.as_number).toBe(65001);
    expect(lastConfigureBody.routing.bgp.neighbors[0].ip_address).toBe('192.168.1.2');
    expect(lastConfigureBody.routing.bgp.neighbors[0].remote_as).toBe(65002);
    
    // RIPの検証
    expect(lastConfigureBody.routing.rip.enabled).toBe(true);
    expect(lastConfigureBody.routing.rip.networks).toContain('192.168.1.0/24');

    // static_routes の検証 (フロントエンドが吐き出すJSON)
    expect(lastConfigureBody.static_routes).toBeDefined();
    expect(lastConfigureBody.static_routes[0].destination).toBe('10.0.0.0/24');
    expect(lastConfigureBody.static_routes[0].next_hop).toBe('192.168.1.254');
  });
});
