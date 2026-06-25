import { create } from 'zustand';

export interface TerminalSession {
  nodeId: string;
  label: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null; // nodeId
  isExpanded: boolean;
  addSession: (nodeId: string, label: string) => void;
  removeSession: (nodeId: string) => void;
  setActiveSessionId: (nodeId: string | null) => void;
  setIsExpanded: (expanded: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,
  isExpanded: false,
  addSession: (nodeId, label) => set((state) => {
    // すでに存在する場合はアクティブにするだけ
    if (state.sessions.some(s => s.nodeId === nodeId)) {
      return { activeSessionId: nodeId };
    }
    return {
      sessions: [...state.sessions, { nodeId, label }],
      activeSessionId: nodeId
    };
  }),
  removeSession: (nodeId) => set((state) => {
    const nextSessions = state.sessions.filter(s => s.nodeId !== nodeId);
    let nextActiveSessionId = state.activeSessionId;
    if (state.activeSessionId === nodeId) {
      nextActiveSessionId = nextSessions.length > 0 ? nextSessions[nextSessions.length - 1].nodeId : null;
    }
    return {
      sessions: nextSessions,
      activeSessionId: nextActiveSessionId
    };
  }),
  setActiveSessionId: (nodeId) => set({ activeSessionId: nodeId }),
  setIsExpanded: (expanded) => set({ isExpanded: expanded }),
}));
