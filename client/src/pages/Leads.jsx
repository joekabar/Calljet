import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

export default function Leads() {
  const { campaignId } = useParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const fileRef = useRef(null);
  const limit = 50;

  useEffect(() => { loadCampaign(); }, [campaignId]);
  useEffect(() => { loadLeads(); }, [campaignId, page, statusFilter]);

  async function loadCampaign() { try { setCampaign(await api.getCampaign(campaignId)); } catch (err) { console.error(err); } }

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await api.getLeads(campaignId, params);
      setLeads(data.leads || []); setTotal(data.total || 0);
    } catch (err) { console.error(err); setError('Failed to load leads. Please try again.'); } finally { setLoading(false); }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importLeads(campaignId, file);
      alert(`Successfully imported ${result.imported} leads`);
      loadLeads();
    } catch (err) { alert('Import failed: ' + err.message); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleDeleteAll() {
    if (!confirm(`Delete ALL ${total} leads from this campaign? This cannot be undone.`)) return;
    try { await api.deleteAllLeads(campaignId); loadLeads(); } catch (err) { alert('Failed: ' + err.message); }
  }

  function handleSearch(e) { e.preventDefault(); setPage(1); loadLeads(); }

  const totalPages = Math.ceil(total / limit);
  const statusOptions = [
    { value: '', label: 'All statuses' }, { value: 'unprocessed', label: 'Unprocessed' }, { value: 'success', label: 'Success' },
    { value: 'not_interested', label: 'Not interested' }, { value: 'auto_redial', label: 'Auto redial' },
    { value: 'private_callback', label: 'Private callback' }, { value: 'shared_callback', label: 'Shared callback' },
    { value: 'invalid', label: 'Invalid' }, { value: 'unqualified', label: 'Unqualified' }, { value: 'in_progress', label: 'In progress' },
  ];

  function getStatusColor(status) {
    const c = { unprocessed: 'bg-gray-100 text-gray-600', success: 'bg-green-100 text-green-700', not_interested: 'bg-red-100 text-red-600', auto_redial: 'bg-blue-100 text-blue-700', private_callback: 'bg-indigo-100 text-indigo-700', shared_callback: 'bg-purple-100 text-purple-700', invalid: 'bg-red-100 text-red-700', unqualified: 'bg-orange-100 text-orange-700', in_progress: 'bg-blue-100 text-blue-700' };
    return c[status] || 'bg-gray-100 text-gray-600';
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Leads</h1><p className="text-sm text-gray-500">{campaign?.name} · {total} total leads</p></div>
        <div className="flex gap-2">
          {isAdmin && total > 0 && <button onClick={handleDeleteAll} className="btn-danger text-sm flex items-center gap-1"><Trash2 className="w-4 h-4" /> Delete all</button>}
          <input type="file" ref={fileRef} accept=".csv,.tsv" className="hidden" onChange={handleImport} />
          {isAdmin && <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" />{importing ? 'Importing...' : 'Import CSV'}</button>}
        </div>
      </div>

      <div className="card p-4 mb-4 flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="input-field pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by phone or company..." /></div>
          <button type="submit" className="btn-secondary text-sm">Search</button>
        </form>
        <select className="input-field w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Attempts</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last contact</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
            : error ? <tr><td colSpan={6} className="px-4 py-12 text-center text-red-500">{error} <button onClick={loadLeads} className="underline ml-2">Retry</button></td></tr>
            : leads.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No leads found</td></tr>
            : leads.map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{lead.phone}</td>
                <td className="px-4 py-3">{lead.data?.Bedrijf || lead.data?.bedrijf || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{lead.data?.stad || lead.data?.Stad || '-'}</td>
                <td className="px-4 py-3"><span className={`status-badge ${getStatusColor(lead.status)}`}>{(lead.status || 'unknown').replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3 text-gray-500">{lead.call_attempts}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-xs text-gray-500">Showing {(page-1)*limit+1} - {Math.min(page*limit,total)} of {total}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 py-1.5 text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
