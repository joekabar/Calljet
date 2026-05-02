import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('active', true)
      .order('label');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get phone numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

export default router;
