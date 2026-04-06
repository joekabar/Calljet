import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) { setUser(session.user); loadProfile(); } setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); if (session?.user) loadProfile(); else setProfile(null); });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() { try { setProfile(await api.getMe()); } catch (err) { console.error('Failed to load profile:', err); } }
  async function signIn(email, password) { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; return data; }
  async function signUp(email, password, name) { const { data, error } = await supabase.auth.signUp({ email, password }); if (error) throw error; if (data.user) await api.registerUser({ id: data.user.id, email, name, role: 'agent' }); return data; }
  async function signOut() { await api.updateStatus('offline').catch(() => {}); await supabase.auth.signOut(); setUser(null); setProfile(null); }

  return <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, loadProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; }
