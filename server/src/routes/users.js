import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Register new user profile (called after Supabase auth signup)
router.post('/register', async (req, res) => {
  try {
    const { id, email, name, display_name, role } = req.body;

    const { data, error } = await supabase
      .from('users')
      .insert({
        id,
        email,
        name,
        display_name: display_name || name.split(' ')[0],
        role: role || 'agent'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Register user error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json(req.user.profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get all users (admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user status
router.put('/status', requireAuth, async (req, res) => {
  try {
    const { status, pause_reason } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ status, pause_reason: status === 'pause' ? pause_reason : null })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Update user profile
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, display_name, role, telnyx_sip_username } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ name, display_name, role, telnyx_sip_username })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
