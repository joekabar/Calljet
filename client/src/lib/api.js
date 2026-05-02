import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || '';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` };
}

async function request(method, path, body = null) {
  const headers = await getAuthHeaders();
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  let res = await fetch(`${API_URL}/api${path}`, options);
  if (res.status === 401) {
    await supabase.auth.refreshSession();
    const retryHeaders = await getAuthHeaders();
    const retryOptions = { method, headers: retryHeaders };
    if (body) retryOptions.body = JSON.stringify(body);
    res = await fetch(`${API_URL}/api${path}`, retryOptions);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  // Campaigns
  getCampaigns: () => request('GET', '/campaigns'),
  getCampaign: (id) => request('GET', `/campaigns/${id}`),
  createCampaign: (data) => request('POST', '/campaigns', data),
  updateCampaign: (id, data) => request('PUT', `/campaigns/${id}`, data),
  deleteCampaign: (id) => request('DELETE', `/campaigns/${id}`),
  assignCampaignUsers: (id, userIds) => request('POST', `/campaigns/${id}/users`, { user_ids: userIds }),

  // Leads
  getLeads: (campaignId, params = {}) => { const q = new URLSearchParams(params).toString(); return request('GET', `/leads/campaign/${campaignId}?${q}`); },
  getLead: (id) => request('GET', `/leads/${id}`),
  getNextLead: (campaignId) => request('POST', '/leads/next', { campaign_id: campaignId }),
  saveLead: (id, data) => request('PUT', `/leads/${id}/save`, data),
  updateLead: (id, data) => request('PUT', `/leads/${id}`, data),
  createLead: (data) => request('POST', '/leads', data),
  deleteLead: (id) => request('DELETE', `/leads/${id}`),
  deleteAllLeads: (campaignId) => request('DELETE', `/leads/campaign/${campaignId}`),
  importLeads: async (campaignId, file, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);
    if (options.phone_column) formData.append('phone_column', options.phone_column);
    if (options.separator) formData.append('separator', options.separator);
    const res = await fetch(`${API_URL}/api/leads/import/${campaignId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
      body: formData
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Import failed'); }
    return res.json();
  },

  // Calls
  logCall: (data) => request('POST', '/calls', data),
  updateCall: (id, data) => request('PUT', `/calls/${id}`, data),
  getLeadCalls: (leadId) => request('GET', `/calls/lead/${leadId}`),
  getMyCalls: (params = {}) => { const q = new URLSearchParams(params).toString(); return request('GET', `/calls/my?${q}`); },

  // Callbacks
  getMyCallbacks: () => request('GET', '/callbacks/my'),
  getCampaignCallbacks: (campaignId) => request('GET', `/callbacks/campaign/${campaignId}`),
  completeCallback: (id) => request('PUT', `/callbacks/${id}/complete`),

  // Phone numbers
  getPhoneNumbers: () => request('GET', '/phone-numbers'),

  // Export leads (file download — needs raw fetch with auth header)
  exportLeads: async (campaignId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_URL}/api/leads/export/${campaignId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads-export.csv'; a.click();
    URL.revokeObjectURL(url);
  },

  // Users
  getMe: () => request('GET', '/users/me'),
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PUT', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  updateStatus: (status, pauseReason) => request('PUT', '/users/status', { status, pause_reason: pauseReason }),
};
