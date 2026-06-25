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
    });

    render(<PropertyPanel />);

    const input = screen.getByLabelText('ホスト名') as HTMLInputElement;
    expect(input.value).toBe('OldName');

    fireEvent.change(input, { target: { value: 'NewRouter' } });

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
            status: 'up',
            interfaces: [],
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
    });

    render(<PropertyPanel />);

    const statusTabBtn = screen.getByRole('button', { name: 'ステータス' });
    fireEvent.click(statusTabBtn);

    const refreshBtn = screen.getByTestId('refresh-status-btn');
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);

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

    expect(screen.getByText('SWITCH')).toBeInTheDocument();

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('access');

    fireEvent.change(select, { target: { value: 'trunk' } });

    let updatedNodes = useTopologyStore.getState().nodes;
    expect(updatedNodes[0].data.interfaces[0].vlanMode).toBe('trunk');

    const vlanInput = screen.getByPlaceholderText('e.g. 10,20') as HTMLInputElement;
    fireEvent.change(vlanInput, { target: { value: '10,20' } });

    updatedNodes = useTopologyStore.getState().nodes;
    expect(updatedNodes[0].data.interfaces[0].vlanIds).toEqual([10, 20]);
  });

  it('OSPFのエリア追加・タイプ設定・レンジ設定・インターフェース割り当てが機能すること', async () => {
    useTopologyStore.setState({
      selectedNodeId: 'router-1',
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'Router-A',
            status: 'down',
            interfaces: [
              { id: 'eth1', name: 'eth1', ipAddress: '10.0.0.1', netmask: '24' },
            ],
            vlanInterfaces: [],
            routing: {
              ospf: {
                enabled: true,
                routerId: '1.1.1.1',
                areas: [],
                redistribute: { connected: false, static: false, rip: false, bgp: false },
                defaultInformationOriginate: { enabled: false, always: false }
              },
              rip: { enabled: false, networks: [] },
              bgp: { enabled: false, asNumber: 65001, routerId: '', neighbors: [] }
            },
            staticRoutes: [],
          }
        }
      ]
    });

    render(<PropertyPanel />);

    // Area ID 入力と追加ボタンのシミュレート
    const areaInput = screen.getByPlaceholderText('エリアID (e.g. 0.0.0.0)') as HTMLInputElement;
    fireEvent.change(areaInput, { target: { value: '0.0.0.10' } });
    
    const addAreaBtn = screen.getByTestId('add-area-btn');
    fireEvent.click(addAreaBtn);

    let routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas.length).toBe(1);
    expect(routerData.routing.ospf.areas[0].areaId).toBe('0.0.0.10');
    expect(routerData.routing.ospf.areas[0].areaType).toBe('normal');

    // エリアタイプの変更
    const typeSelect = screen.getByTestId('area-type-select-0.0.0.10') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'stub' } });
    
    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas[0].areaType).toBe('stub');

    // インターフェースの割り当て
    const ifaceCheckbox = screen.getByTestId('area-0.0.0.10-iface-eth1') as HTMLInputElement;
    fireEvent.click(ifaceCheckbox);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas[0].interfaces).toContain('eth1');

    // レンジ集約の追加
    const rangeInput = screen.getByTestId('area-0.0.0.10-range-input') as HTMLInputElement;
    fireEvent.change(rangeInput, { target: { value: '10.0.0.0/16' } });
    
    const addRangeBtn = screen.getByTestId('area-0.0.0.10-add-range-btn');
    fireEvent.click(addRangeBtn);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas[0].ranges).toContain('10.0.0.0/16');

    // レンジの削除
    const removeRangeBtn = screen.getByTestId('area-0.0.0.10-remove-range-10.0.0.0/16');
    fireEvent.click(removeRangeBtn);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas[0].ranges).not.toContain('10.0.0.0/16');

    // エリアの削除
    const removeAreaBtn = screen.getByTestId('remove-area-0.0.0.10');
    fireEvent.click(removeAreaBtn);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.areas.length).toBe(0);
  });

  it('ルート再配送およびデフォルトルート広告の設定変更がストアに反映されること', () => {
    useTopologyStore.setState({
      selectedNodeId: 'router-1',
      nodes: [
        {
          id: 'router-1',
          type: 'router',
          position: { x: 0, y: 0 },
          data: {
            label: 'Router-A',
            status: 'down',
            interfaces: [],
            vlanInterfaces: [],
            routing: {
              ospf: {
                enabled: true,
                routerId: '1.1.1.1',
                areas: [],
                redistribute: { connected: false, static: false, rip: false, bgp: false },
                defaultInformationOriginate: { enabled: false, always: false }
              },
              rip: {
                enabled: true,
                networks: [],
                redistribute: { connected: false, static: false, ospf: false, bgp: false }
              },
              bgp: {
                enabled: true,
                asNumber: 65001,
                routerId: '1.1.1.1',
                neighbors: [],
                redistribute: { connected: false, static: false, ospf: false, rip: false }
              }
            },
            staticRoutes: [],
          }
        }
      ]
    });

    render(<PropertyPanel />);

    // 1. OSPF 再配送 Connected チェックボックス
    const ospfConnCheckbox = screen.getByTestId('ospf-redistribute-connected') as HTMLInputElement;
    expect(ospfConnCheckbox.checked).toBe(false);
    fireEvent.click(ospfConnCheckbox);
    
    let routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.redistribute.connected).toBe(true);

    // 2. RIP 再配送 Static チェックボックス
    const ripStaticCheckbox = screen.getByTestId('rip-redistribute-static') as HTMLInputElement;
    fireEvent.click(ripStaticCheckbox);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.rip.redistribute.static).toBe(true);

    // 3. BGP 再配送 OSPF チェックボックス
    const bgpOspfCheckbox = screen.getByTestId('bgp-redistribute-ospf') as HTMLInputElement;
    fireEvent.click(bgpOspfCheckbox);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.bgp.redistribute.ospf).toBe(true);

    // 4. OSPF デフォルトルート広告
    const defaultRouteCheckbox = screen.getByTestId('ospf-default-route-enable') as HTMLInputElement;
    fireEvent.click(defaultRouteCheckbox);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.defaultInformationOriginate.enabled).toBe(true);

    // デフォルトルート always
    const alwaysCheckbox = screen.getByTestId('ospf-default-route-always') as HTMLInputElement;
    fireEvent.click(alwaysCheckbox);

    routerData = useTopologyStore.getState().nodes[0].data;
    expect(routerData.routing.ospf.defaultInformationOriginate.always).toBe(true);
  });
});
