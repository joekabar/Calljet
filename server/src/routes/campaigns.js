import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Get all campaigns
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_users(user_id),
        campaign_lead_fields(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add lead counts
    const campaignIds = data.map(c => c.id);
    const { data: leadCounts } = await supabase
      .from('leads')
      .select('campaign_id, status')
      .in('campaign_id', campaignIds);

    const countsMap = {};
    (leadCounts || []).forEach(l => {
      if (!countsMap[l.campaign_id]) {
        countsMap[l.campaign_id] = { total: 0, unprocessed: 0, success: 0 };
      }
      countsMap[l.campaign_id].total++;
      if (l.status === 'unprocessed') countsMap[l.campaign_id].unprocessed++;
      if (l.status === 'success') countsMap[l.campaign_id].success++;
    });

    const enriched = data.map(c => ({
      ...c,
      lead_counts: countsMap[c.id] || { total: 0, unprocessed: 0, success: 0 }
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get single campaign
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_users(user_id, users(id, name, email, status)),
        campaign_lead_fields(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get campaign error:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Create campaign
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, caller_id, campaign_type, manuscript, max_call_attempts, max_ring_time, recording, lead_fields } = req.body;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        name,
        caller_id,
        campaign_type: campaign_type || 'progressive',
        manuscript,
        max_call_attempts: max_call_attempts || 5,
        max_ring_time: max_ring_time || 30,
        recording: recording || 'always',
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    // Create default lead fields if provided
    if (lead_fields && lead_fields.length > 0) {
      const fields = lead_fields.map((f, i) => ({
        campaign_id: campaign.id,
        field_name: f.field_name,
        field_type: f.field_type || 'text',
        field_order: i,
        required: f.required || false,
        editable: f.editable !== false,
        options: f.options || null
      }));

      await supabase.from('campaign_lead_fields').insert(fields);
    }

    res.status(201).json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Update campaign
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update campaign error:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Assign users to campaign
router.post('/:id/users', requireAdmin, async (req, res) => {
  try {
    const { user_ids } = req.body;
    const campaignId = req.params.id;

    // Remove existing
    await supabase
      .from('campaign_users')
      .delete()
      .eq('campaign_id', campaignId);

    // Add new
    if (user_ids && user_ids.length > 0) {
      const rows = user_ids.map(uid => ({
        campaign_id: campaignId,
        user_id: uid
      }));
      await supabase.from('campaign_users').insert(rows);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Assign users error:', err);
    res.status(500).json({ error: 'Failed to assign users' });
  }
});

export default router;
