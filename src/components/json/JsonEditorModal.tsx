import { useState, useEffect } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { X, Copy, Check, Upload } from 'lucide-react';
import './JsonEditorModal.css';

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JsonEditorModal({ isOpen, onClose }: JsonEditorModalProps) {
  const { nodes, edges, setTopology } = useTopologyStore();
  const [jsonText, setJsonText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // モーダルが開かれたら、現在のトポロジ情報をJSON化してセット
  useEffect(() => {
    if (isOpen) {
      const exportData = {
        nodes,
        edges,
      };
      setJsonText(JSON.stringify(exportData, null, 2));
      setErrorMsg(null);
      setIsCopied(false);
    }
  }, [isOpen, nodes, edges]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      setErrorMsg('クリップボードへのコピーに失敗しました。');
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('有効なJSONオブジェクトではありません。');
      }
      if (!Array.isArray(parsed.nodes)) {
        throw new Error('JSONのルートに \"nodes\" 配列が必要です。');
      }
      if (!Array.isArray(parsed.edges)) {
        throw new Error('JSONのルートに \"edges\" 配列が必要です。');
      }

      // トポロジ更新
      setTopology(parsed.nodes, parsed.edges);
      setErrorMsg(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'JSONのパースに失敗しました。構文を確認してください。');
    }
  };

  return (
    <div className="json-modal-overlay fade-in" onClick={onClose} data-testid="json-modal">
      <div className="json-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="json-modal-header">
          <div className="header-title-group">
            <h3>トポロジ JSON インポート/エクスポート</h3>
            <p className="subtitle">トポロジ構成およびノード/リンクの設定をJSON形式で直接編集・管理します。</p>
          </div>
          <button onClick={onClose} className="close-btn" title="閉じる">
            <X size={18} />
          </button>
        </div>

        <div className="json-modal-body">
          <div className="editor-container">
            <textarea
              className="json-textarea"
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="ここにトポロジのJSONデータを貼り付けるか、編集します..."
              spellCheck="false"
            />
          </div>
          {errorMsg && (
            <div className="json-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="json-modal-footer">
          <div className="left-actions">
            <button type="button" onClick={handleCopy} className="action-btn secondary">
              {isCopied ? (
                <>
                  <Check size={16} className="text-success" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy size={16} />
                  JSONをコピー
                </>
              )}
            </button>
          </div>
          <div className="right-actions">
            <button type="button" onClick={onClose} className="action-btn secondary">
              キャンセル
            </button>
            <button type="button" onClick={handleImport} className="action-btn primary">
              <Upload size={16} />
              インポート適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
