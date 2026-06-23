export interface InterfaceData {
  id: string;
  name: string;
  ipAddress: string;
  netmask: string;
  connectedTo?: string; // 接続先ノードID
}

export interface VlanInterfaceData {
  name: string;
  parentInterface: string;
  vlanId: number;
  ipAddress: string; // CIDR format (e.g. 10.10.10.1/24)
}

export interface OspfConfig {
  enabled: boolean;
  routerId: string;
  areaId: string;
  interfaces: string[]; // Active interface names
}

export interface RipConfig {
  enabled: boolean;
  networks: string[]; // Network CIDRs
  interfaces: string[]; // Active interface names
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
}

export interface NetworkEdgeData {
  bandwidth?: string;
  delay?: string;
  cost?: number;
  sourceInterface?: string;
  targetInterface?: string;
}

export interface SwitchInterfaceData {
  id: string;
  name: string;
  vlanMode: 'none' | 'access' | 'trunk';
  vlanId?: number; // for access mode (1-4094)
  vlanIds?: number[]; // for trunk mode (e.g., [10, 20])
  connectedTo?: string; // connected node ID
}

export interface SwitchNodeData {
  label: string;
  status: 'up' | 'down';
  interfaces: SwitchInterfaceData[];
}

