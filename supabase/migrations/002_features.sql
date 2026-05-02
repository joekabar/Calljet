-- ============================================
-- PHONE NUMBERS (global outbound number pool)
-- ============================================
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All access phone_numbers" ON phone_numbers FOR ALL USING (true);

-- ============================================
-- FIX get_next_lead: respect callback_time for auto_redial
-- ============================================
CREATE OR REPLACE FUNCTION get_next_lead(p_campaign_id UUID, p_user_id UUID)
RETURNS leads AS $$
DECLARE
  v_lead leads;
BEGIN
  -- VIP callbacks
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

  IF v_lead.id IS NOT NULL THEN RETURN v_lead; END IF;

  -- Private callbacks
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

  IF v_lead.id IS NOT NULL THEN RETURN v_lead; END IF;

  -- Shared callbacks
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

  IF v_lead.id IS NOT NULL THEN RETURN v_lead; END IF;

  -- Auto-redials: only surface leads whose scheduled callback_time has arrived
  SELECT l.* INTO v_lead
  FROM leads l
  WHERE l.campaign_id = p_campaign_id
    AND l.status = 'auto_redial'
    AND l.blocklisted = false
    AND l.expired = false
    AND (l.callback_time IS NULL OR l.callback_time <= NOW())
    AND l.call_attempts < COALESCE(l.max_call_attempts_override,
        (SELECT max_call_attempts_redial FROM campaigns WHERE id = p_campaign_id))
  ORDER BY l.callback_time ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_lead.id IS NOT NULL THEN RETURN v_lead; END IF;

  -- Unprocessed leads
  SELECT l.* INTO v_lead
  FROM leads l
  WHERE l.campaign_id = p_campaign_id
    AND l.status = 'unprocessed'
    AND l.blocklisted = false
    AND l.expired = false
    AND l.call_attempts < COALESCE(l.max_call_attempts_override,
        (SELECT max_call_attempts FROM campaigns WHERE id = p_campaign_id))
  ORDER BY l.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  RETURN v_lead;
END;
$$ LANGUAGE plpgsql;
