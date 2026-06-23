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
