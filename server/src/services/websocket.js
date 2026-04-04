const clients = new Map(); // userId -> ws connection

export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    let userId = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'auth':
            userId = message.userId;
            clients.set(userId, ws);
            console.log(`Agent connected: ${userId}`);
            broadcastAgentStatus();
            break;

          case 'status_update':
            // Agent changed their status (pause, online, etc.)
            broadcastToAll({
              type: 'agent_status',
              userId: message.userId,
              status: message.status,
              pauseReason: message.pauseReason
            });
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        console.log(`Agent disconnected: ${userId}`);
        broadcastAgentStatus();
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err);
    });
  });
}

export function broadcastAgentStatus() {
  const onlineAgents = Array.from(clients.keys());
  broadcastToAll({
    type: 'agents_online',
    agents: onlineAgents
  });
}

export function broadcastToAll(message) {
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(data);
    }
  });
}

export function sendToUser(userId, message) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

export function getOnlineAgents() {
  return Array.from(clients.keys());
}
