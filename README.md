# CallJet

Power dialer for outbound sales teams. Built with React, Node.js, Supabase, and Telnyx WebRTC.

## Architecture

- **Frontend:** React + Vite + Tailwind → deployed on Vercel
- **Backend:** Node.js + Express + WebSocket → deployed on Railway
- **Database:** Supabase (PostgreSQL)
- **Telephony:** Telnyx WebRTC (browser-based calling)

## Setup

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the contents of `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and anon key from Settings → API

### 2. Telnyx
1. Go to [telnyx.com](https://telnyx.com) and create an account
2. Create a Credential Connection (SIP username + password)
3. Copy your API key from API Keys page
4. Buy or port a phone number for caller ID

### 3. Environment Variables

**Server (`server/.env`):**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TELNYX_API_KEY=KEY...
TELNYX_SIP_USERNAME=userjochensacre18963
TELNYX_SIP_PASSWORD=your_password
TELNYX_CONNECTION_ID=your_connection_id
PORT=3001
CLIENT_URL=http://localhost:5173
```

**Client (`client/.env`):**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_TELNYX_SIP_USERNAME=userjochensacre18963
VITE_TELNYX_SIP_PASSWORD=your_password
VITE_TELNYX_CALLER_ID=+32xxxxxxxxx
```

### 4. Run locally
```bash
# Server
cd server
npm install
npm run dev

# Client (separate terminal)
cd client
npm install
npm run dev
```

### 5. Create first admin user
1. Open http://localhost:5173
2. Sign up with email + password
3. In Supabase dashboard, go to Table Editor → users → edit your user → set role to "admin"

## Deployment

### Vercel (Frontend)
1. Connect GitHub repo
2. Set root directory to `client`
3. Add environment variables (VITE_* vars)

### Railway (Backend)
1. Connect GitHub repo
2. Set root directory to `server`
3. Add environment variables
4. Set start command: `npm start`
