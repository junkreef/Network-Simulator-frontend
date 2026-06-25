const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface ApplyResult {
  success: boolean;
  message: string;
}

export async function applyTopology(topologyData: any): Promise<ApplyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/topology/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(topologyData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'トポロジの適用に失敗しました。');
    }

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '接続エラーが発生しました。',
    };
  }
}

export async function getNodeStatus(nodeId: string, infoType: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}/runtime-info?type=${infoType}`);
    if (!response.ok) {
      throw new Error('ステータス情報の取得に失敗しました。');
    }
    const data = await response.json();
    return data.raw_output || data.output || '';
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

export async function getTopologyState(deployed: boolean = false): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/topology/state?deployed=${deployed}`);
    if (!response.ok) {
      throw new Error('トポロジ状態の取得に失敗しました。');
    }
    return await response.json();
  } catch (error: any) {
    console.error('getTopologyState error:', error);
    return { nodes: [], edges: [] };
  }
}

export async function saveTopologyState(topologyData: any, deployed: boolean = false): Promise<ApplyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/topology/state?deployed=${deployed}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(topologyData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'トポロジ状態の保存に失敗しました。');
    }

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '接続エラーが発生しました。',
    };
  }
}

export async function deleteTopologyState(): Promise<ApplyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/topology/state`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'トポロジ状態のリセットに失敗しました。');
    }

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '接続エラーが発生しました。',
    };
  }
}

export async function setInterfaceState(nodeId: string, interfaceName: string, state: 'up' | 'down'): Promise<ApplyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}/interfaces/${interfaceName}/state?state=${state}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'インターフェース状態の変更に失敗しました。');
    }

    return {
      success: true,
      message: `インターフェースを ${state} に設定しました。`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '接続エラーが発生しました。',
    };
  }
}
