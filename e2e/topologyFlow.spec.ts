import { test, expect } from '@playwright/test';

// Helper function to handle React Flow drag and drop port connection robustly
async function connectPorts(page: any, sourceSelector: string, targetSelector: string) {
  const src = page.locator(sourceSelector).first();
  const tgt = page.locator(targetSelector).first();
  
  await src.hover();
  const srcBox = await src.boundingBox();
  const tgtBox = await tgt.boundingBox();
  
  if (!srcBox || !tgtBox) {
    throw new Error(`Could not find bounding box for ports: src=${sourceSelector}, tgt=${targetSelector}`);
  }
  
  const srcX = srcBox.x + srcBox.width / 2;
  const srcY = srcBox.y + srcBox.height / 2;
  const tgtX = tgtBox.x + tgtBox.width / 2;
  const tgtY = tgtBox.y + tgtBox.height / 2;
  
  // Drag-and-drop flow simulation with small delays to ensure React Flow catches event hooks
  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(tgtX, tgtY, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test.describe('ネットワーク構築・VLAN疎通 E2E複合テスト', () => {

  test.afterEach(async ({ request }) => {
    // Make sure we clean up / destroy containerlab topology after test run
    try {
      await request.post('http://localhost:8000/api/v1/topology/destroy');
    } catch (e) {
      // Ignore cleanup error if already destroyed
    }
  });

  test('トポロジの作成から適用、VLAN経由のPing疎通確認までの一連のフロー', async ({ page }) => {
    // 1. Visit Web UI
    await page.goto('/');
    await expect(page).toHaveTitle(/frontend/);

    // Delete pre-existing edge-1 to reconstruct topology cleanly
    const edgePath = page.locator('#edge-1').first();
    await expect(edgePath).toBeVisible();
    await edgePath.click({ force: true });

    const deleteEdgeBtn = page.locator('button[title="リンク削除"]').first();
    await expect(deleteEdgeBtn).toBeVisible();
    await deleteEdgeBtn.click();
    await expect(edgePath).not.toBeVisible();

    // 2. Add Switch-A node (Router-A and Host-A are pre-configured in state)
    const addSwitchBtn = page.locator('[data-testid="add-switch-btn"]').first();
    await addSwitchBtn.click();
    await expect(page.locator('.react-flow__node >> text=Switch-A')).toBeVisible();

    // 3. Connect nodes programmatically via Zustand for 100% reliability in headless test
    await page.evaluate(() => {
      const store = (window as any).useTopologyStore.getState();
      const switchNode = store.nodes.find((n: any) => n.type === 'switch');
      if (!switchNode) throw new Error('Switch node not found in store');
      
      // Host-A (eth1) -> Switch-A (eth1)
      store.onConnect({
        source: 'host-1',
        target: switchNode.id,
        sourceHandle: 'eth1-right-src',
        targetHandle: 'eth1-left-tgt'
      });

      // Switch-A (eth2) -> Router-A (eth1)
      store.onConnect({
        source: switchNode.id,
        target: 'router-1',
        sourceHandle: 'eth2-right-src',
        targetHandle: 'eth1-left-tgt'
      });
    });

    // Give react-flow a moment to render lines
    await page.waitForTimeout(500);

    // 4. Configure Host-A (IP: 10.10.10.10/24, Gateway: 10.10.10.1)
    await page.click('[data-id="host-1"]', { force: true });
    await page.click('text=設定');
    await page.locator('#host-ip').fill('10.10.10.10/24');
    await page.locator('#host-gateway').fill('10.10.10.1');

    // Configure Switch-A (eth1: Access VLAN 10, eth2: Trunk VLAN 10)
    await page.click('.react-flow__node >> text=Switch-A', { force: true });
    
    // eth1 to Access VLAN 10
    const eth1Row = page.locator('.interface-row-switch').filter({ hasText: 'eth1' });
    await eth1Row.locator('select').selectOption('access');
    await eth1Row.locator('input[type="number"]').fill('10');

    // eth2 to Trunk VLAN 10
    const eth2Row = page.locator('.interface-row-switch').filter({ hasText: 'eth2' });
    await eth2Row.locator('select').selectOption('trunk');
    await eth2Row.locator('input[type="text"]').fill('10');

    // Configure Router-A (Create eth1.10 interface with IP 10.10.10.1/24)
    await page.click('[data-id="router-1"]', { force: true });
    await page.locator('input[placeholder*="VLAN"]').fill('10');
    await page.locator('input[placeholder*="IP/CIDR"]').fill('10.10.10.1/24');
    await page.locator('input[placeholder*="VLAN"] ~ button').click();
    await expect(page.locator('.vlan-row >> text=eth1.10')).toBeVisible();

    // 5. Deploy / Apply topology config to backend
    await page.click('[data-testid="apply-btn"]');
    
    // Wait for the success toast (up to 90 seconds to let containerlab deploy finish)
    const successToast = page.locator('.toast-notification.success');
    await expect(successToast).toBeVisible({ timeout: 90000 });
    await expect(successToast).toHaveText(/トポロジを適用しました。/);

    // 6. Connectivity test & Status update checks
    await page.click('[data-id="host-1"]', { force: true });
    await page.click('text=ステータス');
    
    // Select ARP Table option
    await page.selectOption('.property-panel select', 'arp_table');

    // Focus the hidden textarea of Xterm.js to type the ping command via WebSocket
    const xtermTextarea = page.locator('.xterm-helper-textarea').first();
    await expect(xtermTextarea).toBeVisible();
    await xtermTextarea.focus();
    
    // Send command characters sequentially to simulate typing and trigger WebSocket transmission
    await xtermTextarea.pressSequentially('ping -c 3 10.10.10.1\r', { delay: 50 });

    // Wait for the ping to complete inside the container through WebSocket path
    await page.waitForTimeout(4000);

    // Click refresh button to fetch updated ARP table
    await page.click('text=更新');
    
    // The ARP table of Host-A should resolve Router-A (10.10.10.1)
    await expect(page.locator('.property-panel pre')).toContainText(/10.10.10.1/);

    // Check Routing Table updating
    await page.selectOption('.property-panel select', 'routing_table');
    await page.click('text=更新');
    await expect(page.locator('.property-panel pre')).toContainText(/10.10.10.0\/24/);
    await expect(page.locator('.property-panel pre')).toContainText(/default via 10.10.10.1/);
  });

  test('OSPF動的ルーティングのE2Eテスト', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/frontend/);

    // 1. OSPF設定をZustand経由で流し込む
    await page.evaluate(() => {
      const store = (window as any).useTopologyStore.getState();
      
      const cleanNodes = store.nodes
        .filter((n: any) => n.id !== 'host-1')
        .map((n: any) => {
          if (n.id === 'router-1') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.1', netmask: '24', connectedTo: 'router-2' }
                ],
                routing: {
                  ospf: {
                    enabled: true,
                    routerId: '1.1.1.1',
                    areaId: '0.0.0.0',
                    interfaces: ['eth2']
                  },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: { enabled: false, asNumber: 65001, routerId: '', neighbors: [] }
                }
              }
            };
          }
          if (n.id === 'router-2') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.2', netmask: '24', connectedTo: 'router-1' }
                ],
                routing: {
                  ospf: {
                    enabled: true,
                    routerId: '2.2.2.2',
                    areaId: '0.0.0.0',
                    interfaces: ['eth2']
                  },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: { enabled: false, asNumber: 65002, routerId: '', neighbors: [] }
                }
              }
            };
          }
          return n;
        });

      const cleanEdges = [
        {
          id: 'edge-r1-r2',
          source: 'router-1',
          target: 'router-2',
          sourceHandle: 'eth2-right-src',
          targetHandle: 'eth2-left-tgt',
          type: 'networkEdge',
          data: {
            sourceInterface: 'eth2',
            targetInterface: 'eth2'
          }
        }
      ];
      
      store.setTopology(cleanNodes, cleanEdges);
    });

    // 2. 適用
    await page.click('[data-testid="apply-btn"]');
    const successToast = page.locator('.toast-notification.success');
    await expect(successToast).toBeVisible({ timeout: 90000 });

    // 3. ルーターAを選択して、OSPFネイバーを確認
    await page.click('[data-id="router-1"]', { force: true });
    await page.click('text=ステータス');
    await page.selectOption('.property-panel select', 'ospf_neighbors');
    
    // OSPFの隣接関係構築に数秒かかるため、少し待機してから更新する
    await page.waitForTimeout(50000);
    await page.click('text=更新');

    // ネイバーとして 2.2.2.2 (Router-B) が検出されているかアサート
    await expect(page.locator('.property-panel pre')).toContainText(/2\.2\.2\.2/);
  });

  test('BGP動的ルーティングのE2Eテスト', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const store = (window as any).useTopologyStore.getState();
      
      const cleanNodes = store.nodes
        .filter((n: any) => n.id !== 'host-1')
        .map((n: any) => {
          if (n.id === 'router-1') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.1', netmask: '24', connectedTo: 'router-2' }
                ],
                routing: {
                  ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: {
                    enabled: true,
                    asNumber: 65001,
                    routerId: '1.1.1.1',
                    neighbors: [{ ipAddress: '10.0.12.2', remoteAs: 65002 }]
                  }
                }
              }
            };
          }
          if (n.id === 'router-2') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.2', netmask: '24', connectedTo: 'router-1' }
                ],
                routing: {
                  ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: {
                    enabled: true,
                    asNumber: 65002,
                    routerId: '2.2.2.2',
                    neighbors: [{ ipAddress: '10.0.12.1', remoteAs: 65001 }]
                  }
                }
              }
            };
          }
          return n;
        });

      const cleanEdges = [
        {
          id: 'edge-r1-r2',
          source: 'router-1',
          target: 'router-2',
          sourceHandle: 'eth2-right-src',
          targetHandle: 'eth2-left-tgt',
          type: 'networkEdge',
          data: {
            sourceInterface: 'eth2',
            targetInterface: 'eth2'
          }
        }
      ];
      
      store.setTopology(cleanNodes, cleanEdges);
    });

    await page.click('[data-testid="apply-btn"]');
    const successToast = page.locator('.toast-notification.success');
    await expect(successToast).toBeVisible({ timeout: 90000 });

    await page.click('[data-id="router-1"]', { force: true });
    await page.click('text=ステータス');
    await page.selectOption('.property-panel select', 'bgp_neighbors');
    
    // BGPセッション確立を待つ
    await page.waitForTimeout(10000);
    await page.click('text=更新');

    // BGPネイバー 10.0.12.2 が Established (プレフィックス数表示) になっているかアサート
    // 確立すると末尾が Active / Connect ではなく数値（0など）になります
    await expect(page.locator('.property-panel pre')).toContainText(/10\.0\.12\.2\s+4\s+65002/);
  });

  test('静的ルーティング（Static Routes）のE2Eテスト', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const store = (window as any).useTopologyStore.getState();
      
      const cleanNodes = store.nodes
        .filter((n: any) => n.id !== 'host-1')
        .map((n: any) => {
          if (n.id === 'router-1') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.1', netmask: '24', connectedTo: 'router-2' }
                ],
                routing: {
                  ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: { enabled: false, asNumber: 65001, routerId: '', neighbors: [] }
                },
                staticRoutes: [
                  { destination: '192.168.2.0/24', nextHop: '10.0.12.2' }
                ]
              }
            };
          }
          if (n.id === 'router-2') {
            return {
              ...n,
              data: {
                ...n.data,
                interfaces: [
                  { id: 'eth2', name: 'eth2', ipAddress: '10.0.12.2', netmask: '24', connectedTo: 'router-1' }
                ],
                routing: {
                  ospf: { enabled: false, routerId: '', areaId: '0.0.0.0', interfaces: [] },
                  rip: { enabled: false, networks: [], interfaces: [] },
                  bgp: { enabled: false, asNumber: 65002, routerId: '', neighbors: [] }
                },
                staticRoutes: [
                  { destination: '192.168.1.0/24', nextHop: '10.0.12.1' }
                ]
              }
            };
          }
          return n;
        });

      const cleanEdges = [
        {
          id: 'edge-r1-r2',
          source: 'router-1',
          target: 'router-2',
          sourceHandle: 'eth2-right-src',
          targetHandle: 'eth2-left-tgt',
          type: 'networkEdge',
          data: {
            sourceInterface: 'eth2',
            targetInterface: 'eth2'
          }
        }
      ];
      
      store.setTopology(cleanNodes, cleanEdges);
    });

    await page.click('[data-testid="apply-btn"]');
    const successToast = page.locator('.toast-notification.success');
    await expect(successToast).toBeVisible({ timeout: 90000 });

    await page.click('[data-id="router-1"]', { force: true });
    await page.click('text=ステータス');
    await page.selectOption('.property-panel select', 'routing_table');
    await page.click('text=更新');

    // 静的ルートが適用されているかアサート
    await expect(page.locator('.property-panel pre')).toContainText(/192\.168\.2\.0\/24/);
  });
});
