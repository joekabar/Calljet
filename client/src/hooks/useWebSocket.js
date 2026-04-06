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
    ws.onopen = () => { setConnected(true); ws.send(JSON.stringify({ type: 'auth', userId })); reconnectRef.current = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 30000); };
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'agents_online') setOnlineAgents(m.agents); else setLastEvent(m); } catch {} };
    ws.onclose = () => { setConnected(false); clearInterval(reconnectRef.current); setTimeout(() => connectWs(), 3000); };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [userId]);

  useEffect(() => { connectWs(); return () => { clearInterval(reconnectRef.current); if (wsRef.current) wsRef.current.close(); }; }, [connectWs]);
  const sendMessage = useCallback((m) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(m)); }, []);
  return { connected, onlineAgents, lastEvent, sendMessage };
}
