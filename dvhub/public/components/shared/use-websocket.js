import { useEffect, useRef } from 'preact/hooks';
import { wsConnected, telemetry, config, prices, dvStatus, execStatus } from './use-signal-store.js';

/**
 * WebSocket hook with exponential backoff reconnection.
 * Connects to the given URL, dispatches messages to the global signal store.
 */
export function useWebSocket(url) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wsConnected.value = true;
        retryRef.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          switch (data.type) {
            case 'telemetry':
              telemetry.value = data.data;
              // Extract EPEX prices array for PriceChart (epex.data has {ts, ct_kwh, ...})
              if (data.data?.epex?.data) {
                prices.value = data.data.epex.data.map(s => ({ ts: s.ts, price: s.ct_kwh }));
              }
              break;
            case 'config':
              config.value = data.data;
              break;
            case 'prices':
              prices.value = data.data;
              break;
            case 'dv':
              dvStatus.value = data.data;
              break;
            case 'exec':
              execStatus.value = data.data;
              break;
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsConnected.value = false;
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current++;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on cleanup
        wsRef.current.close();
      }
    };
  }, [url]);
}
