import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useCall } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { Phone, Users, CheckCircle, Clock, Play, List } from 'lucide-react';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { connect, connectionStatus } = useCall();
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [c, cb] = await Promise.all([
        api.getCampaigns(),
        api.getMyCallbacks()
      ]);
      setCampaigns(c);
      setCallbacks(cb);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function startDialing(campaignId) {
    // Connect WebRTC if not connected
    if (connectionStatus !== 'connected') {
      connect(
        import.meta.env.VITE_TELNYX_SIP_USERNAME,
        import.meta.env.VITE_TELNYX_SIP_PASSWORD
      );
    }
    navigate(`/dialer/${campaignId}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calljet-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {profile?.display_name || 'Agent'}</h1>
        <p className="text-gray-500 mt-1">Select a campaign to start dialing</p>
      </div>

      {/* Upcoming callbacks */}
      {callbacks.length > 0 && (
        <div className="card p-5 mb-6 border-l-4 border-l-amber-400">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            Upcoming callbacks ({callbacks.length})
          </h3>
          <div className="space-y-2">
            {callbacks.slice(0, 3).map(cb => (
              <div key={cb.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{cb.leads?.data?.Bedrijf || cb.leads?.phone}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-500">{cb.campaigns?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    {new Date(cb.scheduled_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className={`status-badge ${
                    cb.callback_type === 'vip' ? 'bg-purple-100 text-purple-700' :
                    cb.callback_type === 'private' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {cb.callback_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaigns grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{campaign.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{campaign.campaign_type}</p>
              </div>
              <span className={`status-badge ${campaign.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {campaign.active ? 'Active' : 'Paused'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-800">{campaign.lead_counts?.total || 0}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-lg font-bold text-blue-600">{campaign.lead_counts?.unprocessed || 0}</p>
                <p className="text-xs text-gray-500">Queue</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{campaign.lead_counts?.success || 0}</p>
                <p className="text-xs text-gray-500">Success</p>
              </div>
            </div>

            {campaign.caller_id && (
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {campaign.caller_id}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => startDialing(campaign.id)}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                disabled={!campaign.active}
              >
                <Play className="w-4 h-4" /> Start dialing
              </button>
              <button
                onClick={() => navigate(`/leads/${campaign.id}`)}
                className="btn-secondary flex items-center justify-center gap-2 text-sm"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm">Create your first campaign to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
