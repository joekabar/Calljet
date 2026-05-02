import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';

import campaignRoutes from './routes/campaigns.js';
import leadRoutes from './routes/leads.js';
import callRoutes from './routes/calls.js';
import callbackRoutes from './routes/callbacks.js';
import userRoutes from './routes/users.js';
import webhookRoutes from './routes/webhooks.js';
import phoneNumberRoutes from './routes/phoneNumbers.js';
import { setupWebSocket } from './services/websocket.js';

const app = express();
const server = createServer(app);

// Trust Railway proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/callbacks', callbackRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
setupWebSocket(wss);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CallJet server running on port ${PORT}`);
});
