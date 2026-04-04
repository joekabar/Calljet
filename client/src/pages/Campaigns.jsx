import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Save } from 'lucide-react';

export default function Campaigns() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    caller_id: '',
    campaign_type: 'progressive',
    manuscript: '',
    max_call_attempts: 5,
    max_ring_time: 30,
    recording: 'always',
    lead_fields: [
      { field_name: 'Bedrijf', field_type: 'text' },
      { field_name: 'Telefoonnummer', field_type: 'phone' },
      { field_name: 'Adres', field_type: 'text' },
      { field_name: 'Postcode', field_type: 'text' },
      { field_name: 'Stad', field_type: 'text' },
    ]
  });

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createCampaign(form);
      setShowCreate(false);
      setForm({ name: '', caller_id: '', campaign_type: 'progressive', manuscript: '', max_call_attempts: 5, max_ring_time: 30, recording: 'always', lead_fields: [] });
      loadCampaigns();
    } catch (err) {
      alert('Failed to create campaign: ' + err.message);
    }
  }

  function addField() {
    setForm(prev => ({
      ...prev,
      lead_fields: [...prev.lead_fields, { field_name: '', field_type: 'text' }]
    }));
  }

  function removeField(index) {
    setForm(prev => ({
      ...prev,
      lead_fields: prev.lead_fields.filter((_, i) => i !== index)
    }));
  }

  function updateField(index, key, value) {
    setForm(prev => ({
      ...prev,
      lead_fields: prev.lead_fields.map((f, i) => i === index ? { ...f, [key]: value } : f)
    }));
  }

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

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create campaign</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Campaign name</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Caller ID (phone number)</label>
                <input className="input-field" value={form.caller_id} onChange={e => setForm({ ...form, caller_id: e.target.value })} placeholder="+32..." />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input-field" value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value })}>
                  <option value="progressive">Progressive</option>
                  <option value="preview">Preview</option>
                </select>
              </div>
              <div>
                <label className="label">Max call attempts</label>
                <input type="number" className="input-field" value={form.max_call_attempts} onChange={e => setForm({ ...form, max_call_attempts: parseInt(e.target.value) })} min={1} max={50} />
              </div>
            </div>

            <div>
              <label className="label">Call script (HTML)</label>
              <textarea className="input-field min-h-[120px]" value={form.manuscript} onChange={e => setForm({ ...form, manuscript: e.target.value })} placeholder="Enter your call script..." />
            </div>

            {/* Lead fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Lead fields</label>
                <button type="button" onClick={addField} className="text-xs text-calljet-600 hover:text-calljet-700">+ Add field</button>
              </div>
              <div className="space-y-2">
                {form.lead_fields.map((field, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input-field flex-1"
                      value={field.field_name}
                      onChange={e => updateField(i, 'field_name', e.target.value)}
                      placeholder="Field name"
                    />
                    <select className="input-field w-32" value={field.field_type} onChange={e => updateField(i, 'field_type', e.target.value)}>
                      <option value="text">Text</option>
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                      <option value="textarea">Textarea</option>
                    </select>
                    <button type="button" onClick={() => removeField(i)} className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> Create campaign
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calljet-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-gray-500">{c.campaign_type} · {c.lead_counts?.total || 0} leads · {c.lead_counts?.unprocessed || 0} in queue</p>
              </div>
              <span className={`status-badge ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.active ? 'Active' : 'Paused'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
