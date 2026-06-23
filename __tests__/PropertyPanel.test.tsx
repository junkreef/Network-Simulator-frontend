import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import PropertyPanel from '../src/components/property/PropertyPanel';
import { useTopologyStore } from '../src/store/topologyStore';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

describe('PropertyPanel Component', () => {
  it('should render empty state if no node is selected', () => {
    useTopologyStore.setState({ selectedNodeId: null, selectedEdgeId: null });
    render(<PropertyPanel />);
    expect(screen.getByTestId('property-panel-empty')).toBeInTheDocument();
  });

  it('ルーター名を入力した際に状態が正しく更新されること', () => {
    // モック状態の設定
    useTopologyStore.setState({
      selectedNodeId: 'router-1',
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'OldName',
            status: 'down',
            interfaces: [],
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
    });

    render(<PropertyPanel />);

    const input = screen.getByLabelText('ホスト名') as HTMLInputElement;
    expect(input.value).toBe('OldName');

    // 値の変更をシミュレート
    fireEvent.change(input, { target: { value: 'NewRouter' } });

    // 状態が反映されていることをアサート
    const updatedNodes = useTopologyStore.getState().nodes;
    expect(updatedNodes[0].data.label).toBe('NewRouter');
  });

  it('should fetch status on refresh click in status tab', async () => {
    useTopologyStore.setState({
      selectedNodeId: 'router-1',
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'Router-A',
            status: 'up', // status API requires 'up'
            interfaces: [],
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
    });

    render(<PropertyPanel />);

    // Click "ステータス" tab
    const statusTabBtn = screen.getByRole('button', { name: 'ステータス' });
    fireEvent.click(statusTabBtn);

    // Verify "更新" button is visible
    const refreshBtn = screen.getByTestId('refresh-status-btn');
    expect(refreshBtn).toBeInTheDocument();

    // Click "更新"
    fireEvent.click(refreshBtn);

    // Wait for the mock output
    await waitFor(() => {
      const viewer = screen.getByTestId('cli-viewer');
      expect(viewer).toHaveTextContent('Mock Output for Node router-1 [routing_table]');
    });
  });
});
