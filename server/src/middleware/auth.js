import supabase from '../services/supabase.js';
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization token' });
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (!profile) {
      const { data: newProfile, error: insertErr } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        display_name: user.user_metadata?.name?.split(' ')[0] || user.email.split('@')[0],
        role: 'agent'
      }).select().single();
      if (insertErr) { console.error('Auto-create user profile failed:', insertErr); return res.status(500).json({ error: 'Failed to create user profile' }); }
      req.user = { ...user, profile: newProfile };
      return next();
    }
    req.user = { ...user, profile };
    next();
  } catch (err) { return res.status(401).json({ error: 'Authentication failed' }); }
}
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user?.profile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}
