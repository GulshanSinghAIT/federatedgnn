import { create } from 'zustand';

export interface RoundMetric {
  model_name: string;
  round_num: number;
  hospital_id: string;
  accuracy: number;
  f1_score: number;
  loss?: number;
  sp_difference: number;
  eo_difference: number;
  nodes_trained?: number;
  timestamp: string;
}

export interface FederationState {
  isRunning: boolean;
  currentRound: number;
  totalRounds: number;
  activeModel: string;
  hospitals: string[];
  history: RoundMetric[];
  wsEvents: Array<{ timestamp: string; message: string; type: string }>;
  globalMetrics: {
    accuracy?: number;
    f1_score?: number;
    sp_difference?: number;
    eo_difference?: number;
  };
  hospitalMetrics: Record<string, {
    accuracy?: number;
    f1_score?: number;
    sp_difference?: number;
    eo_difference?: number;
    nodes_trained?: number;
    status: string;
  }>;

  setRunning: (running: boolean) => void;
  setRound: (round: number, total: number) => void;
  setActiveModel: (model: string) => void;
  addRoundMetric: (metric: RoundMetric) => void;
  addWsEvent: (event: { timestamp: string; message: string; type: string }) => void;
  updateHospitalMetrics: (hospitalId: string, metrics: any) => void;
  updateGlobalMetrics: (metrics: any) => void;
  resetHistory: () => void;
  setHistory: (h: RoundMetric[]) => void;
}

export const useFederationStore = create<FederationState>((set) => ({
  isRunning: false,
  currentRound: 0,
  totalRounds: 0,
  activeModel: 'FedFairGNN',
  hospitals: ['H1', 'H2', 'H3'],
  history: [],
  wsEvents: [],
  globalMetrics: {},
  hospitalMetrics: {
    H1: { status: 'idle' },
    H2: { status: 'idle' },
    H3: { status: 'idle' },
  },

  setRunning: (running) => set({ isRunning: running }),
  setRound: (round, total) => set({ currentRound: round, totalRounds: total }),
  setActiveModel: (model) => set({ activeModel: model }),
  addRoundMetric: (metric) => set((s) => ({ history: [...s.history, metric] })),
  addWsEvent: (event) => set((s) => ({
    wsEvents: [...s.wsEvents.slice(-100), event] // keep last 100
  })),
  updateHospitalMetrics: (hospitalId, metrics) => set((s) => ({
    hospitalMetrics: {
      ...s.hospitalMetrics,
      [hospitalId]: { ...s.hospitalMetrics[hospitalId], ...metrics }
    }
  })),
  updateGlobalMetrics: (metrics) => set({ globalMetrics: metrics }),
  resetHistory: () => set({ history: [], wsEvents: [], currentRound: 0, globalMetrics: {} }),
  setHistory: (h) => set({ history: h }),
}));
