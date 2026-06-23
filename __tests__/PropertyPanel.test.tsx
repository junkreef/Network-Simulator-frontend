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

  it('スイッチのVLANモードやIDを変更した際に状態が正しく更新されること', () => {
    useTopologyStore.setState({
      selectedNodeId: 'switch-1',
      nodes: [
        {
          id: 'switch-1',
          type: 'switch',
          position: { x: 0, y: 0 },
          data: {
            label: 'Switch-A',
            status: 'down',
            interfaces: [
              { id: 'eth0', name: 'eth0', vlanMode: 'access', vlanId: 1, vlanIds: [] }
            ]
          }
        }
      ]
    });

    render(<PropertyPanel />);

    // "SWITCH"というバッジが表示されていることを確認
    expect(screen.getByText('SWITCH')).toBeInTheDocument();

    // モード選択を取得してTrunkに変更
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('access');

    fireEvent.change(select, { target: { value: 'trunk' } });

    // 状態が反映されていることをアサート
    let updatedNodes = useTopologyStore.getState().nodes;
    expect(updatedNodes[0].data.interfaces[0].vlanMode).toBe('trunk');

    // 再レンダリングされてVLANs入力ボックスが出現しているか確認
    const vlanInput = screen.getByPlaceholderText('e.g. 10,20') as HTMLInputElement;
    fireEvent.change(vlanInput, { target: { value: '10,20' } });

    updatedNodes = useTopologyStore.getState().nodes;
    expect(updatedNodes[0].data.interfaces[0].vlanIds).toEqual([10, 20]);
  });
});
