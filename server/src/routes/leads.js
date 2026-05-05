import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/campaign/:campaignId', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * Number(limit);

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('campaign_id', req.params.campaignId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`phone.ilike.%${search}%,data->>Bedrijf.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ leads: data || [], total: count || 0, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/export/:campaignId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', req.params.campaignId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const dataKeys = [...new Set(data.flatMap(l => Object.keys(l.data || {})))];
    const headers = ['phone', 'status', 'call_attempts', 'last_contacted_at', 'callback_time', ...dataKeys];
    const escape = v => {
      const s = v == null ? '' : String(v);
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = data.map(l =>
      [l.phone, l.status, l.call_attempts, l.last_contacted_at || '', l.callback_time || '',
       ...dataKeys.map(k => escape(l.data?.[k]))].join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');
    res.send('﻿' + [headers.join(','), ...rows].join('\n'));
  } catch (err) {
    console.error('Export leads error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const [calls, notes, callbacks, activity] = await Promise.all([
      supabase.from('calls').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('notes').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('callbacks').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, users(name)').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(50),
    ]);

    res.json({ ...lead, calls: calls.data || [], notes: notes.data || [], callbacks: callbacks.data || [], activity: activity.data || [] });
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/next', requireAuth, async (req, res) => {
  try {
    const { campaign_id } = req.body;
    const { data, error } = await supabase.rpc('get_next_lead', { p_campaign_id: campaign_id, p_user_id: req.user.id });
    if (error) throw error;
    if (!data) return res.json({ lead: null, message: 'No leads available' });

    // Guard: skip auto_redial leads whose callback_time hasn't arrived yet.
    // The DB function may not filter these if migration 002 hasn't been applied.
    if (data.status === 'auto_redial' && data.callback_time && new Date(data.callback_time) > new Date()) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('status', 'unprocessed')
        .eq('blocklisted', false)
        .eq('expired', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fallbackErr) throw fallbackErr;
      if (!fallback) return res.json({ lead: null, message: 'No leads available' });
      data = fallback;
    }

    await supabase.from('leads').update({ status: 'in_progress', assigned_to: req.user.id }).eq('id', data.id);
    res.json({ lead: data });
  } catch (err) {
    console.error('Next lead error:', err);
    res.status(500).json({ error: 'Failed to get next lead' });
  }
});

router.put('/:id/save', requireAuth, async (req, res) => {
  try {
    const { status, data: leadData, note, callback_time, callback_type, blocklist } = req.body;
    const leadId = req.params.id;
    const userId = req.user.id;

    const TERMINAL_STATUSES = ['not_interested', 'unqualified', 'invalid', 'success'];
    const updateFields = { status, data: leadData, last_contacted_by: userId, last_contacted_at: new Date().toISOString(), blocklisted: blocklist || false };
    if (callback_time) {
      updateFields.callback_time = callback_time;
      updateFields.callback_type = callback_type || 'private';
    } else if (TERMINAL_STATUSES.includes(status)) {
      updateFields.callback_time = null;
      updateFields.callback_type = null;
    }

    const { data: lead, error } = await supabase.from('leads').update(updateFields).eq('id', leadId).select().single();
    if (error) throw error;

    if (note && note.trim()) {
      await supabase.from('notes').insert({ lead_id: leadId, user_id: userId, content: note });
    }

    if (callback_time && status !== 'auto_redial') {
      await supabase.from('callbacks').update({ completed: true, completed_at: new Date().toISOString() }).eq('lead_id', leadId).eq('completed', false);
      await supabase.from('callbacks').insert({ lead_id: leadId, user_id: callback_type === 'shared' ? null : userId, campaign_id: lead.campaign_id, scheduled_at: callback_time, callback_type: callback_type || 'private' });
    }

    await supabase.from('activity_log').insert({ lead_id: leadId, user_id: userId, campaign_id: lead.campaign_id, action: 'lead_saved', details: { status, callback_time, callback_type } });
    res.json(lead);
  } catch (err) {
    console.error('Save lead error:', err);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('leads').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.delete('/campaign/:campaignId', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('leads').delete().eq('campaign_id', req.params.campaignId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete leads' });
  }
});

// CSV import - with BOM fix and auto separator detection
router.post('/import/:campaignId', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log('Import file:', req.file.originalname, req.file.size, 'bytes');

    const campaignId = req.params.campaignId;
    const leads = [];

    // Remove BOM and normalize
    let fileContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Auto-detect separator
    const firstLine = fileContent.split('\n')[0] || '';
    const separator = req.body.separator || (firstLine.includes(';') ? ';' : ',');
    console.log('Separator:', JSON.stringify(separator), 'Headers:', firstLine.substring(0, 200));

    const stream = Readable.from(fileContent);
    await new Promise((resolve, reject) => {
      stream.pipe(csv({ separator }))
        .on('data', (row) => {
          const phone = row.Telefoonnummer || row.telefoonnummer || row.Phone || row.phone || row.Tel || row.tel || row.Telefoon || row.PhoneNumber || row.phone_number || row[req.body.phone_column];
          if (phone && phone.toString().trim()) {
            const data = { ...row };
            ['Telefoonnummer','telefoonnummer','Phone','phone','Tel','tel','Telefoon','PhoneNumber','phonenumber','phone_number'].forEach(k => delete data[k]);
            leads.push({ campaign_id: campaignId, phone: phone.toString().trim(), data, status: 'unprocessed' });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log('Parsed leads:', leads.length);
    if (leads.length === 0) return res.status(400).json({ error: 'No valid leads found. Make sure CSV has a phone column.' });

    const batchSize = 500;
    let imported = 0;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const { error } = await supabase.from('leads').insert(batch);
      if (error) { console.error('Batch error:', error); throw error; }
      imported += batch.length;
    }

    res.json({ imported, total: leads.length });
  } catch (err) {
    console.error('CSV import error:', err.message);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { campaign_id, phone, data: leadData } = req.body;
    const { data, error } = await supabase.from('leads').insert({ campaign_id, phone, data: leadData || {}, status: 'unprocessed' }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

export default router;
