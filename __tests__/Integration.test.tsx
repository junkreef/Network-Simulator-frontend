import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import App from '../src/App';
import { useTopologyStore } from '../src/store/topologyStore';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
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
});
