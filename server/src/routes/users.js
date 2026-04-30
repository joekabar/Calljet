import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/register', requireAuth, async (req, res) => {
  try {
    // Profile auto-created by requireAuth middleware; update with name from signup form
    const { name } = req.body;
    if (name) {
      const display_name = name.split(' ')[0];
      const { data, error } = await supabase.from('users').update({ name, display_name }).eq('id', req.user.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    res.status(200).json(req.user.profile);
  } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Failed to register user' }); }
});

router.get('/me', requireAuth, async (req, res) => { res.json(req.user.profile); });

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

router.put('/status', requireAuth, async (req, res) => {
  try {
    const { status, pause_reason } = req.body;
    const { data, error } = await supabase.from('users').update({ status, pause_reason: status === 'pause' ? pause_reason : null }).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to update status' }); }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, display_name, role, telnyx_sip_username } = req.body;
    const { data, error } = await supabase.from('users').update({ name, display_name, role, telnyx_sip_username }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to update user' }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { console.error('Delete user error:', err); res.status(500).json({ error: 'Failed to delete user' }); }
});

export default router;
