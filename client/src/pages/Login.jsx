import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Phone } from 'lucide-react';

export default function Login() {
  const { signIn, accessDeniedError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signIn(email, password); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  const displayError = accessDeniedError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-calljet-950 via-calljet-900 to-calljet-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-calljet-500 rounded-2xl mb-4"><Phone className="w-8 h-8 text-white" /></div>
          <h1 className="text-3xl font-bold text-white">CallJet</h1>
          <p className="text-calljet-300 mt-1">Power dialer for your team</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in</h2>
          {displayError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{displayError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="label">Email</label><input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></div>
            <div><label className="label">Password</label><input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required /></div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
