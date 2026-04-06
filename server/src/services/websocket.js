const clients = new Map();
export function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    let userId = null;
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'auth') { userId = msg.userId; clients.set(userId, ws); broadcastAgentStatus(); }
        else if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        else if (msg.type === 'status_update') broadcastToAll({ type: 'agent_status', userId: msg.userId, status: msg.status });
      } catch (err) { console.error('WS error:', err); }
    });
    ws.on('close', () => { if (userId) { clients.delete(userId); broadcastAgentStatus(); } });
    ws.on('error', (err) => console.error('WS error:', err));
  });
}
export function broadcastAgentStatus() { broadcastToAll({ type: 'agents_online', agents: Array.from(clients.keys()) }); }
export function broadcastToAll(message) { const d = JSON.stringify(message); clients.forEach(ws => { if (ws.readyState === 1) ws.send(d); }); }
export function sendToUser(userId, message) { const ws = clients.get(userId); if (ws && ws.readyState === 1) ws.send(JSON.stringify(message)); }
