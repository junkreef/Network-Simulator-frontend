export interface InterfaceData {
  id: string;
  name: string;
  ipAddress: string;
  netmask: string;
  connectedTo?: string; // 接続先ノードID
  adminState?: 'up' | 'down';
}

export interface VlanInterfaceData {
  name: string;
  parentInterface: string;
  vlanId: number;
  ipAddress: string; // CIDR format (e.g. 10.10.10.1/24)
}

export interface OspfAreaConfig {
  areaId: string;
  interfaces: string[]; // このエリアに所属させるインターフェース
  ranges?: string[];     // ルート集約設定 (例: ["10.0.0.0/24"])
  areaType?: 'normal' | 'stub' | 'totally-stub' | 'nssa' | 'totally-nssa';
}

export interface RedistributionConfig {
  connected?: boolean; // 直結ルート
  static?: boolean;    // 静的ルート
  ospf?: boolean;      // OSPFから学習したルート
  rip?: boolean;       // RIPから学習したルート
  bgp?: boolean;       // BGPから学習したルート
}

export interface OspfConfig {
  enabled: boolean;
  routerId: string;
  areas: OspfAreaConfig[];
  redistribute?: RedistributionConfig; // OSPFへの再配送設定
  defaultInformationOriginate?: {
    enabled: boolean;
    always?: boolean;
    metric?: number;
  };
}

export interface RipConfig {
  enabled: boolean;
  networks: string[]; // Network CIDRs
  interfaces?: string[]; // Active interface names
  redistribute?: RedistributionConfig; // RIPへの再配送設定
}

export interface BgpNeighbor {
  ipAddress: string;
  remoteAs: number;
}

export interface BgpConfig {
  enabled: boolean;
  asNumber: number;
  routerId: string;
  neighbors: BgpNeighbor[];
  redistribute?: RedistributionConfig; // BGPへの再配送設定
}

export interface StaticRoute {
  destination: string; // CIDR format (e.g. 172.16.0.0/16)
  nextHop: string;
}

export interface RouterNodeData {
  label: string;
  status: 'up' | 'down';
  interfaces: InterfaceData[];
  vlanInterfaces: VlanInterfaceData[];
  routing: {
    ospf: OspfConfig;
    rip: RipConfig;
    bgp: BgpConfig;
  };
  staticRoutes: StaticRoute[];
}

export interface HostNodeData {
  label: string;
  status: 'up' | 'down';
  ipAddress: string; // CIDR format (e.g. 192.168.1.10/24)
  gateway: string;
  connectedTo?: string;
  vlanInterfaces: VlanInterfaceData[];
  eth1AdminState?: 'up' | 'down';
}

export interface NetworkEdgeData {
  bandwidth?: string;
  delay?: string;
  cost?: number;
  sourceInterface?: string;
  targetInterface?: string;
  status?: 'up' | 'down';
}

export interface SwitchInterfaceData {
  id: string;
  name: string;
  vlanMode: 'none' | 'access' | 'trunk';
  vlanId?: number; // for access mode (1-4094)
  vlanIds?: number[]; // for trunk mode (e.g., [10, 20])
  connectedTo?: string; // connected node ID
  adminState?: 'up' | 'down';
}

export interface SwitchNodeData {
  label: string;
  status: 'up' | 'down';
  interfaces: SwitchInterfaceData[];
}

