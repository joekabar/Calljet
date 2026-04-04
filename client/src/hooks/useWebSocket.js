import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(userId) {
  const [connected, setConnected] = useState(false);
  const [onlineAgents, setOnlineAgents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connectWs = useCallback(() => {
    if (!userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = import.meta.env.VITE_WS_URL || `${protocol}://${window.location.host}`;
    const ws = new WebSocket(`${host}/ws`);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'auth', userId }));

      // Start heartbeat
      reconnectRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'agents_online':
            setOnlineAgents(message.agents);
            break;
          case 'call_event':
          case 'agent_status':
            setLastEvent(message);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(reconnectRef.current);
      // Reconnect after 3 seconds
      setTimeout(() => connectWs(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [userId]);

  useEffect(() => {
    connectWs();
    return () => {
      clearInterval(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { connected, onlineAgents, lastEvent, sendMessage };
}
