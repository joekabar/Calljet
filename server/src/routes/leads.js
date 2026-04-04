import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Get leads for a campaign (paginated)
router.get('/campaign/:campaignId', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select('*, last_contacted_by_user:users!leads_last_contacted_by_fkey(name)', { count: 'exact' })
      .eq('campaign_id', req.params.campaignId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`phone.ilike.%${search}%,data->>Bedrijf.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ leads: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead with full activity
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Get related data in parallel
    const [calls, notes, callbacks, activity] = await Promise.all([
      supabase.from('calls').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('notes').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('callbacks').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(50),
    ]);

    res.json({
      ...lead,
      calls: calls.data || [],
      notes: notes.data || [],
      callbacks: callbacks.data || [],
      activity: activity.data || []
    });
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Get next lead for progressive dialing
router.post('/next', requireAuth, async (req, res) => {
  try {
    const { campaign_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase.rpc('get_next_lead', {
      p_campaign_id: campaign_id,
      p_user_id: userId
    });

    if (error) throw error;

    if (!data) {
      return res.json({ lead: null, message: 'No leads available' });
    }

    // Mark as in_progress
    await supabase
      .from('leads')
      .update({ status: 'in_progress', assigned_to: userId })
      .eq('id', data.id);

    res.json({ lead: data });
  } catch (err) {
    console.error('Next lead error:', err);
    res.status(500).json({ error: 'Failed to get next lead' });
  }
});

// Save/close lead with status
router.put('/:id/save', requireAuth, async (req, res) => {
  try {
    const { status, data: leadData, note, callback_time, callback_type, blocklist } = req.body;
    const leadId = req.params.id;
    const userId = req.user.id;

    // Update lead
    const updateFields = {
      status,
      data: leadData,
      last_contacted_by: userId,
      last_contacted_at: new Date().toISOString(),
      blocklisted: blocklist || false
    };

    if (callback_time) {
      updateFields.callback_time = callback_time;
      updateFields.callback_type = callback_type || 'private';
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateFields)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;

    // Create note if provided
    if (note && note.trim()) {
      await supabase.from('notes').insert({
        lead_id: leadId,
        user_id: userId,
        content: note
      });
    }

    // Create callback if scheduled
    if (callback_time) {
      // Mark existing callbacks as completed
      await supabase
        .from('callbacks')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('lead_id', leadId)
        .eq('completed', false);

      await supabase.from('callbacks').insert({
        lead_id: leadId,
        user_id: callback_type === 'shared' ? null : userId,
        campaign_id: lead.campaign_id,
        scheduled_at: callback_time,
        callback_type: callback_type || 'private'
      });
    }

    // Log activity
    await supabase.from('activity_log').insert({
      lead_id: leadId,
      user_id: userId,
      campaign_id: lead.campaign_id,
      action: 'lead_saved',
      details: { status, callback_time, callback_type }
    });

    res.json(lead);
  } catch (err) {
    console.error('Save lead error:', err);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// Update lead data
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// CSV import
router.post('/import/:campaignId', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const campaignId = req.params.campaignId;
    const phoneColumn = req.body.phone_column || 'phone';
    const leads = [];

    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv({ separator: req.body.separator || ',' }))
        .on('data', (row) => {
          const phone = row[phoneColumn] || row.Telefoonnummer || row.Phone || row.phone || row.tel;
          if (phone) {
            const data = { ...row };
            delete data[phoneColumn];
            leads.push({
              campaign_id: campaignId,
              phone: phone.toString().trim(),
              data,
              status: 'unprocessed'
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No valid leads found in CSV' });
    }

    // Batch insert (Supabase limit is ~1000 per request)
    const batchSize = 500;
    let imported = 0;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const { error } = await supabase.from('leads').insert(batch);
      if (error) throw error;
      imported += batch.length;
    }

    res.json({ imported, total: leads.length });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// Create single lead manually
router.post('/', requireAuth, async (req, res) => {
  try {
    const { campaign_id, phone, data: leadData } = req.body;

    const { data, error } = await supabase
      .from('leads')
      .insert({
        campaign_id,
        phone,
        data: leadData || {},
        status: 'unprocessed'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

export default router;
