import { Loader2, UserCircle } from 'lucide-react';

export default function LeadPanel({ lead, campaign, leadData, onUpdateField, onFetchNext, fetchingLead }) {
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        {fetchingLead ? (<><Loader2 className="w-8 h-8 animate-spin mb-3" /><p>Loading next lead...</p></>) : (<><UserCircle className="w-12 h-12 mb-3 opacity-30" /><p className="font-medium">No active lead</p><button onClick={onFetchNext} className="btn-primary mt-4 text-sm">Get next lead</button></>)}
      </div>
    );
  }

  const fields = campaign?.campaign_lead_fields?.length > 0
    ? campaign.campaign_lead_fields.filter(f => f.active).sort((a, b) => a.field_order - b.field_order)
    : Object.keys(leadData).map((key, i) => ({ field_name: key, field_type: key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel') ? 'phone' : 'text', field_order: i, editable: true }));

  function getStatusBadge(status) {
    const c = { unprocessed: 'bg-gray-100 text-gray-600', auto_redial: 'bg-blue-100 text-blue-700', private_callback: 'bg-indigo-100 text-indigo-700', shared_callback: 'bg-purple-100 text-purple-700', vip_callback: 'bg-amber-100 text-amber-700', success: 'bg-green-100 text-green-700', not_interested: 'bg-red-100 text-red-600', unqualified: 'bg-orange-100 text-orange-700', invalid: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700', contacted: 'bg-cyan-100 text-cyan-700' };
    return c[status] || 'bg-gray-100 text-gray-600';
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2"><span className="text-xs text-gray-400 font-medium">Campaign</span><span className="text-sm font-semibold">{campaign?.name}</span></div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">Lead status</span>
          <span className={`status-badge ${getStatusBadge(lead.status)}`}>{lead.status.replace(/_/g, ' ')}</span>
          {lead.call_attempts > 0 && <span className="text-xs text-gray-400">{lead.call_attempts} attempt{lead.call_attempts !== 1 ? 's' : ''}</span>}
        </div>
      </div>
      <div className="mb-4"><label className="label">Phone</label><input type="tel" className="input-field font-mono" value={lead.phone} readOnly /></div>
      <div className="space-y-4">
        {fields.map(field => {
          const key = field.field_name; const value = leadData[key] || ''; const isEditable = field.editable !== false;
          return (
            <div key={key}>
              <label className="label">{key}</label>
              {field.field_type === 'textarea' ? <textarea className="input-field min-h-[80px] resize-y" value={value} onChange={e => onUpdateField(key, e.target.value)} readOnly={!isEditable} />
              : <input type={field.field_type === 'phone' ? 'tel' : field.field_type === 'email' ? 'email' : 'text'} className="input-field" value={value} onChange={e => onUpdateField(key, e.target.value)} readOnly={!isEditable} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
