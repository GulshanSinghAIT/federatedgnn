import { useEffect, useRef, useCallback } from 'react';
import { useFederationStore } from '../store/federationStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useFederationStore();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/federation`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });

        switch (data.event) {
          case 'hospital_round_complete':
            store.addWsEvent({
              timestamp: now,
              message: `${data.hospital_id} → Round ${data.round} complete | Acc: ${(data.accuracy * 100).toFixed(1)}% | ΔSP: ${data.sp_difference?.toFixed(3)}`,
              type: 'hospital'
            });
            store.updateHospitalMetrics(data.hospital_id, {
              accuracy: data.accuracy,
              f1_score: data.f1_score,
              sp_difference: data.sp_difference,
              eo_difference: data.eo_difference,
              nodes_trained: data.nodes_trained,
              status: 'completed'
            });
            store.addRoundMetric({
              model_name: data.model,
              round_num: data.round,
              hospital_id: data.hospital_id,
              accuracy: data.accuracy,
              f1_score: data.f1_score,
              loss: data.loss,
              sp_difference: data.sp_difference,
              eo_difference: data.eo_difference,
              nodes_trained: data.nodes_trained,
              timestamp: now
            });
            break;

          case 'global_aggregation_complete':
            store.addWsEvent({
              timestamp: now,
              message: `GLOBAL → Round ${data.round} aggregation | Acc: ${(data.global_accuracy * 100).toFixed(1)}% | ΔSP: ${data.sp_difference?.toFixed(3)}`,
              type: 'global'
            });
            store.updateGlobalMetrics({
              accuracy: data.global_accuracy,
              f1_score: data.global_f1,
              sp_difference: data.sp_difference,
              eo_difference: data.eo_difference,
            });
            store.setRound(data.round, store.totalRounds);
            store.addRoundMetric({
              model_name: data.model,
              round_num: data.round,
              hospital_id: 'global',
              accuracy: data.global_accuracy,
              f1_score: data.global_f1,
              sp_difference: data.sp_difference,
              eo_difference: data.eo_difference,
              loss: 0,
              timestamp: now
            });
            break;

          case 'model_training_start':
            store.addWsEvent({
              timestamp: now,
              message: `Starting ${data.model} training (${data.total_rounds} rounds)`,
              type: 'system'
            });
            store.setActiveModel(data.model);
            store.setRound(0, data.total_rounds);
            break;

          case 'model_training_complete':
            store.addWsEvent({
              timestamp: now,
              message: `${data.model} training complete`,
              type: 'system'
            });
            break;

          case 'federation_complete':
            store.setRunning(false);
            store.addWsEvent({
              timestamp: now,
              message: 'Federation training complete',
              type: 'system'
            });
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
