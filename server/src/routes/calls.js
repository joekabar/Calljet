import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Log a new call
router.post('/', requireAuth, async (req, res) => {
  try {
    const { lead_id, campaign_id, phone_number, telnyx_call_id, direction, caller_id_used } = req.body;

    const { data, error } = await supabase
      .from('calls')
      .insert({
        lead_id,
        user_id: req.user.id,
        campaign_id,
        phone_number,
        telnyx_call_id,
        direction: direction || 'outbound',
        caller_id_used
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead call attempts
    if (lead_id) {
      const { data: currentLead } = await supabase
        .from('leads')
        .select('call_attempts')
        .eq('id', lead_id)
        .single();

      await supabase
        .from('leads')
        .update({ call_attempts: (currentLead?.call_attempts || 0) + 1 })
        .eq('id', lead_id);

      // Log activity
      await supabase.from('activity_log').insert({
        lead_id,
        user_id: req.user.id,
        campaign_id,
        action: 'call',
        details: { direction, phone_number, telnyx_call_id }
      });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Log call error:', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// Update call (after hangup - duration, disposition, recording)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update call error:', err);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// Get calls for a lead
router.get('/lead/:leadId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*, users(name)')
      .eq('lead_id', req.params.leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get lead calls error:', err);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

// Get call history for current user
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('calls')
      .select('*, leads(phone, data), campaigns(name)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ calls: data, total: count });
  } catch (err) {
    console.error('Get my calls error:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

export default router;
