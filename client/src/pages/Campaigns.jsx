import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Save, Trash2, Play, List, Edit2 } from 'lucide-react';

export default function Campaigns() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', caller_id: '', campaign_type: 'progressive', manuscript: '',
    max_call_attempts: 5, max_ring_time: 30, recording: 'always',
    lead_fields: [
      { field_name: 'Bedrijf', field_type: 'text' },
      { field_name: 'Adres', field_type: 'text' },
      { field_name: 'Postcode', field_type: 'text' },
      { field_name: 'Stad', field_type: 'text' },
      { field_name: 'Provintie', field_type: 'text' },
    ]
  });

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try { setCampaigns(await api.getCampaigns()); } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createCampaign(form);
      setShowCreate(false);
      setForm({ name: '', caller_id: '', campaign_type: 'progressive', manuscript: '', max_call_attempts: 5, max_ring_time: 30, recording: 'always', lead_fields: [] });
      loadCampaigns();
    } catch (err) { alert('Failed: ' + err.message); }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete campaign "${name}"? This will also delete all its leads and call history.`)) return;
    try { await api.deleteCampaign(id); loadCampaigns(); } catch (err) { alert('Failed: ' + err.message); }
  }

  async function toggleActive(id, currentActive) {
    try { await api.updateCampaign(id, { active: !currentActive }); loadCampaigns(); } catch (err) { alert('Failed: ' + err.message); }
  }

  function addField() { setForm(p => ({ ...p, lead_fields: [...p.lead_fields, { field_name: '', field_type: 'text' }] })); }
  function removeField(i) { setForm(p => ({ ...p, lead_fields: p.lead_fields.filter((_, j) => j !== i) })); }
  function updateField(i, k, v) { setForm(p => ({ ...p, lead_fields: p.lead_fields.map((f, j) => j === i ? { ...f, [k]: v } : f) })); }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        {isAdmin && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New campaign
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create campaign</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Campaign name</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Caller ID</label><input className="input-field" value={form.caller_id} onChange={e => setForm({ ...form, caller_id: e.target.value })} placeholder="+32..." /></div>
              <div><label className="label">Type</label><select className="input-field" value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value })}><option value="progressive">Progressive</option><option value="preview">Preview</option></select></div>
              <div><label className="label">Max call attempts</label><input type="number" className="input-field" value={form.max_call_attempts} onChange={e => setForm({ ...form, max_call_attempts: parseInt(e.target.value) })} min={1} max={50} /></div>
            </div>
            <div><label className="label">Call script</label><textarea className="input-field min-h-[120px]" value={form.manuscript} onChange={e => setForm({ ...form, manuscript: e.target.value })} placeholder="Enter your call script..." /></div>
            <div>
              <div className="flex items-center justify-between mb-2"><label className="label mb-0">Lead fields</label><button type="button" onClick={addField} className="text-xs text-calljet-600 hover:text-calljet-700">+ Add field</button></div>
              <div className="space-y-2">
                {form.lead_fields.map((field, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="input-field flex-1" value={field.field_name} onChange={e => updateField(i, 'field_name', e.target.value)} placeholder="Field name" />
                    <select className="input-field w-32" value={field.field_type} onChange={e => updateField(i, 'field_type', e.target.value)}><option value="text">Text</option><option value="phone">Phone</option><option value="email">Email</option><option value="textarea">Textarea</option></select>
                    <button type="button" onClick={() => removeField(i)} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calljet-600" /></div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm text-gray-500">{c.campaign_type} · {c.lead_counts?.total || 0} leads · {c.lead_counts?.unprocessed || 0} in queue · {c.lead_counts?.success || 0} success</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate(`/dialer/${c.id}`)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" disabled={!c.active}><Play className="w-3 h-3" /> Dial</button>
                  <button onClick={() => navigate(`/leads/${c.id}`)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"><List className="w-3 h-3" /> Leads</button>
                  {isAdmin && (
                    <>
                      <button onClick={() => toggleActive(c.id, c.active)} className={`text-xs py-1.5 px-3 rounded-lg font-medium ${c.active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {c.active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <p className="text-center py-12 text-gray-400">No campaigns yet. Create one to get started.</p>}
        </div>
      )}
    </div>
  );
}
