import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => { res.json(req.user.profile); });

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, email, password, role = 'agent' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });
  if (authErr) return res.status(400).json({ error: authErr.message });

  const display_name = name.split(' ')[0];
  const { data: profile, error: profileErr } = await supabase.from('users')
    .insert({ id: authData.user.id, email, name, display_name, role })
    .select().single();

  if (profileErr) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return res.status(500).json({ error: 'Failed to create user profile' });
  }

  res.status(201).json(profile);
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
    const { error: dbErr } = await supabase.from('users').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;

    await supabase.auth.admin.deleteUser(req.params.id).catch(e =>
      console.error('Auth delete warning:', e.message)
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
