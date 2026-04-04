import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get upcoming callbacks for current user
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('callbacks')
      .select('*, leads(phone, data, campaign_id), campaigns(name)')
      .or(`user_id.eq.${req.user.id},user_id.is.null`)
      .eq('completed', false)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get callbacks error:', err);
    res.status(500).json({ error: 'Failed to fetch callbacks' });
  }
});

// Get callbacks for a campaign
router.get('/campaign/:campaignId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('callbacks')
      .select('*, leads(phone, data), users(name)')
      .eq('campaign_id', req.params.campaignId)
      .eq('completed', false)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get campaign callbacks error:', err);
    res.status(500).json({ error: 'Failed to fetch callbacks' });
  }
});

// Mark callback as completed
router.put('/:id/complete', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('callbacks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Complete callback error:', err);
    res.status(500).json({ error: 'Failed to complete callback' });
  }
});

export default router;
