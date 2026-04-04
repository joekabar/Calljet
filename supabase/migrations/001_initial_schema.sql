-- CallJet Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS / AGENTS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'dialing', 'in_call', 'wrap_up', 'pause', 'offline')),
  pause_reason TEXT,
  telnyx_sip_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  caller_id TEXT, -- outbound number
  campaign_type TEXT NOT NULL DEFAULT 'progressive' CHECK (campaign_type IN ('progressive', 'preview')),
  manuscript TEXT, -- HTML call script
  max_call_attempts INT NOT NULL DEFAULT 5,
  max_call_attempts_redial INT NOT NULL DEFAULT 10,
  max_ring_time INT NOT NULL DEFAULT 30,
  recording TEXT NOT NULL DEFAULT 'always' CHECK (recording IN ('always', 'on_demand', 'never')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- LEAD FIELDS (dynamic per campaign)
-- ============================================
CREATE TABLE campaign_lead_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'phone', 'email', 'textarea', 'select', 'website')),
  field_order INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  editable BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  options JSONB, -- for select type fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unprocessed' CHECK (status IN (
    'unprocessed', 'auto_redial', 'private_callback', 'shared_callback',
    'vip_callback', 'success', 'not_interested', 'unqualified', 'invalid',
    'in_progress', 'contacted'
  )),
  phone TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}', -- dynamic lead fields (bedrijf, adres, postcode, stad, etc.)
  call_attempts INT NOT NULL DEFAULT 0,
  max_call_attempts_override INT, -- per-lead override
  assigned_to UUID REFERENCES users(id),
  last_contacted_by UUID REFERENCES users(id),
  last_contacted_at TIMESTAMPTZ,
  callback_time TIMESTAMPTZ,
  callback_type TEXT CHECK (callback_type IN ('private', 'shared', 'vip')),
  blocklisted BOOLEAN NOT NULL DEFAULT false,
  expired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_campaign_status ON leads(campaign_id, status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_callback ON leads(callback_time) WHERE callback_time IS NOT NULL;
CREATE INDEX idx_leads_phone ON leads(phone);

-- ============================================
-- CALLS
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  telnyx_call_id TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  caller_id_used TEXT,
  disposition TEXT CHECK (disposition IN ('answered', 'no_answer', 'busy', 'failed', 'congestion', 'cancelled')),
  duration_seconds INT DEFAULT 0,
  ring_duration_seconds INT DEFAULT 0,
  recording_url TEXT,
  recording_status TEXT DEFAULT 'none' CHECK (recording_status IN ('none', 'recording', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_lead ON calls(lead_id);
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_telnyx ON calls(telnyx_call_id);

-- ============================================
-- NOTES
-- ============================================
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_lead ON notes(lead_id);

-- ============================================
-- CALLBACKS
-- ============================================
CREATE TABLE callbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- null for shared callbacks
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  callback_type TEXT NOT NULL DEFAULT 'private' CHECK (callback_type IN ('private', 'shared', 'vip')),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_callbacks_scheduled ON callbacks(scheduled_at) WHERE completed = false;
CREATE INDEX idx_callbacks_user ON callbacks(user_id) WHERE completed = false;

-- ============================================
-- CAMPAIGN USERS (which agents can dial which campaigns)
-- ============================================
CREATE TABLE campaign_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

-- ============================================
-- ACTIVITY LOG (timeline events)
-- ============================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  campaign_id UUID REFERENCES campaigns(id),
  action TEXT NOT NULL, -- 'call', 'status_change', 'note', 'callback_set', 'booking', 'lead_saved'
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_lead ON activity_log(lead_id);
CREATE INDEX idx_activity_created ON activity_log(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_lead_fields ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow authenticated users from same client)
-- In production, scope by organization/client_id
CREATE POLICY "Authenticated users can read all" ON users FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update own" ON users FOR UPDATE USING (true);
CREATE POLICY "All access campaigns" ON campaigns FOR ALL USING (true);
CREATE POLICY "All access leads" ON leads FOR ALL USING (true);
CREATE POLICY "All access calls" ON calls FOR ALL USING (true);
CREATE POLICY "All access notes" ON notes FOR ALL USING (true);
CREATE POLICY "All access callbacks" ON callbacks FOR ALL USING (true);
CREATE POLICY "All access campaign_users" ON campaign_users FOR ALL USING (true);
CREATE POLICY "All access activity_log" ON activity_log FOR ALL USING (true);
CREATE POLICY "All access campaign_lead_fields" ON campaign_lead_fields FOR ALL USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get next lead for progressive dialing
CREATE OR REPLACE FUNCTION get_next_lead(p_campaign_id UUID, p_user_id UUID)
RETURNS leads AS $$
DECLARE
  v_lead leads;
BEGIN
  -- First check for VIP callbacks
  SELECT l.* INTO v_lead
  FROM leads l
  JOIN callbacks c ON c.lead_id = l.id
  WHERE l.campaign_id = p_campaign_id
    AND c.callback_type = 'vip'
    AND c.completed = false
    AND c.scheduled_at <= NOW()
    AND (c.user_id = p_user_id OR c.user_id IS NULL)
    AND l.blocklisted = false
    AND l.expired = false
  ORDER BY c.scheduled_at ASC
  LIMIT 1
  FOR UPDATE OF l SKIP LOCKED;

  IF v_lead.id IS NOT NULL THEN
    RETURN v_lead;
  END IF;

  -- Then private callbacks
  SELECT l.* INTO v_lead
  FROM leads l
  JOIN callbacks c ON c.lead_id = l.id
  WHERE l.campaign_id = p_campaign_id
    AND c.callback_type = 'private'
    AND c.completed = false
    AND c.scheduled_at <= NOW()
    AND c.user_id = p_user_id
    AND l.blocklisted = false
    AND l.expired = false
  ORDER BY c.scheduled_at ASC
  LIMIT 1
  FOR UPDATE OF l SKIP LOCKED;

  IF v_lead.id IS NOT NULL THEN
    RETURN v_lead;
  END IF;

  -- Then shared callbacks
  SELECT l.* INTO v_lead
  FROM leads l
  JOIN callbacks c ON c.lead_id = l.id
  WHERE l.campaign_id = p_campaign_id
    AND c.callback_type = 'shared'
    AND c.completed = false
    AND c.scheduled_at <= NOW()
    AND l.blocklisted = false
    AND l.expired = false
  ORDER BY c.scheduled_at ASC
  LIMIT 1
  FOR UPDATE OF l SKIP LOCKED;

  IF v_lead.id IS NOT NULL THEN
    RETURN v_lead;
  END IF;

  -- Then auto-redials
  SELECT l.* INTO v_lead
  FROM leads l
  WHERE l.campaign_id = p_campaign_id
    AND l.status = 'auto_redial'
    AND l.blocklisted = false
    AND l.expired = false
    AND l.call_attempts < COALESCE(l.max_call_attempts_override, (SELECT max_call_attempts FROM campaigns WHERE id = p_campaign_id))
  ORDER BY l.last_contacted_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_lead.id IS NOT NULL THEN
    RETURN v_lead;
  END IF;

  -- Finally unprocessed leads
  SELECT l.* INTO v_lead
  FROM leads l
  WHERE l.campaign_id = p_campaign_id
    AND l.status = 'unprocessed'
    AND l.blocklisted = false
    AND l.expired = false
    AND l.call_attempts < COALESCE(l.max_call_attempts_override, (SELECT max_call_attempts FROM campaigns WHERE id = p_campaign_id))
  ORDER BY l.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  RETURN v_lead;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_campaigns_updated BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
