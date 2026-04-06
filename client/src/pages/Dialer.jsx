import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import PhoneBar from '../components/PhoneBar';
import LeadPanel from '../components/LeadPanel';
import ResultPanel from '../components/ResultPanel';
import ActivityPanel from '../components/ActivityPanel';
import ManuscriptPanel from '../components/ManuscriptPanel';
import { Loader2 } from 'lucide-react';

export default function Dialer() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { connect, connectionStatus, callState, makeCall, hangup } = useCall();

  const [campaign, setCampaign] = useState(null);
  const [currentLead, setCurrentLead] = useState(null);
  const [leadData, setLeadData] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchingLead, setFetchingLead] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activeTab, setActiveTab] = useState('data');

  useEffect(() => { loadCampaign(); }, [campaignId]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      connect(import.meta.env.VITE_TELNYX_SIP_USERNAME, import.meta.env.VITE_TELNYX_SIP_PASSWORD);
    }
    api.updateStatus('online').catch(console.error);
    return () => { api.updateStatus('offline').catch(console.error); };
  }, []);

  async function loadCampaign() {
    try { const c = await api.getCampaign(campaignId); setCampaign(c); setLoading(false); }
    catch (err) { console.error('Load campaign error:', err); navigate('/'); }
  }

  const fetchNextLead = useCallback(async () => {
    if (fetchingLead) return;
    setFetchingLead(true);
    try {
      const result = await api.getNextLead(campaignId);
      if (result.lead) { setCurrentLead(result.lead); setLeadData(result.lead.data || {}); }
      else { setCurrentLead(null); setLeadData({}); alert('No leads available in the queue'); }
    } catch (err) { console.error('Fetch lead error:', err); }
    finally { setFetchingLead(false); }
  }, [campaignId, fetchingLead]);

  useEffect(() => { if (campaign && !currentLead) fetchNextLead(); }, [campaign]);

  function dialLead() {
    if (!currentLead || callState !== 'idle') return;
    makeCall(currentLead.phone, { leadId: currentLead.id, campaignId: campaign.id, callerId: campaign.caller_id });
  }

  async function saveLead(saveData) {
    if (!currentLead) return;
    try {
      await api.saveLead(currentLead.id, { ...saveData, data: leadData });
      setCurrentLead(null); setLeadData({});
      await fetchNextLead();
    } catch (err) { console.error('Save lead error:', err); alert('Failed to save lead'); }
  }

  async function postponeLead() { if (!currentLead) return; await saveLead({ status: 'auto_redial' }); }
  function updateLeadField(key, value) { setLeadData(prev => ({ ...prev, [key]: value })); }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-calljet-600" /></div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <PhoneBar lead={currentLead} campaign={campaign} onDial={dialLead} onHangup={hangup} onToggleActivity={() => setShowActivity(!showActivity)} showActivity={showActivity} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-auto">
          <div className="bg-white border-b px-6 py-2 flex items-center gap-1">
            <span className="text-sm font-medium text-gray-500 mr-4">
              Lead data {currentLead && <span className="text-gray-400 text-xs ml-1">ID: {currentLead.id.slice(0, 8)}</span>}
            </span>
            {campaign?.manuscript && (
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setActiveTab('data')} className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'data' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>Lead data</button>
                <button onClick={() => setActiveTab('manuscript')} className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'manuscript' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>Script</button>
              </div>
            )}
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'data' ? (
                <LeadPanel lead={currentLead} campaign={campaign} leadData={leadData} onUpdateField={updateLeadField} onFetchNext={fetchNextLead} fetchingLead={fetchingLead} />
              ) : (
                <ManuscriptPanel campaign={campaign} lead={currentLead} leadData={leadData} />
              )}
            </div>
            <div className="w-[400px] border-l bg-white overflow-auto">
              <ResultPanel lead={currentLead} campaign={campaign} onSave={saveLead} onPostpone={postponeLead} />
            </div>
          </div>
        </div>

        {showActivity && currentLead && (
          <div className="w-[380px] border-l bg-white overflow-auto">
            <ActivityPanel lead={currentLead} onClose={() => setShowActivity(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
