import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { api } from '../lib/api';
import PhoneBar from '../components/PhoneBar';
import LeadPanel from '../components/LeadPanel';
import ResultPanel from '../components/ResultPanel';
import ActivityPanel from '../components/ActivityPanel';
import ManuscriptPanel from '../components/ManuscriptPanel';
import { Loader2 } from 'lucide-react';

const COUNTDOWN_MS = 3000;
const COUNTDOWN_TICK_MS = 50; // progress bar refresh rate

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
  const [queueEmpty, setQueueEmpty] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [selectedCallerId, setSelectedCallerId] = useState(null);

  // Agent-level auto-dial preferences (persisted per browser)
  const [autoDialEnabled, setAutoDialEnabled] = useLocalStorage('calljet.autoDial.enabled', true);
  const [autoDialDelayEnabled, setAutoDialDelayEnabled] = useLocalStorage('calljet.autoDial.delay', true);

  // Countdown state: 0..1 progress; null = no countdown running
  const [countdownProgress, setCountdownProgress] = useState(null);
  const countdownTimerRef = useRef(null);
  const countdownStartRef = useRef(null);
  const countdownCancelledRef = useRef(false);

  // Stable refs for values we read inside timers / event handlers
  const currentLeadRef = useRef(null);
  const campaignRef = useRef(null);
  const callStateRef = useRef(callState);
  useEffect(() => { currentLeadRef.current = currentLead; }, [currentLead]);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const isProgressive = campaign?.campaign_type === 'progressive';
  const autoDialActive = isProgressive && autoDialEnabled;

  // ---------- initial load ----------
  useEffect(() => { loadCampaign(); loadPhoneNumbers(); }, [campaignId]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      connect(import.meta.env.VITE_TELNYX_SIP_USERNAME, import.meta.env.VITE_TELNYX_SIP_PASSWORD);
    }
    api.updateStatus('online').catch(console.error);
    return () => { api.updateStatus('offline').catch(console.error); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPhoneNumbers() {
    try { setPhoneNumbers(await api.getPhoneNumbers()); } catch { /* non-critical */ }
  }

  async function loadCampaign() {
    try {
      const c = await api.getCampaign(campaignId);
      setCampaign(c);
      setLoading(false);
    } catch (err) {
      console.error('Load campaign error:', err);
      navigate('/');
    }
  }

  // ---------- countdown machinery ----------
  function stopCountdown() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    countdownStartRef.current = null;
    setCountdownProgress(null);
  }

  const cancelCountdown = useCallback(() => {
    countdownCancelledRef.current = true;
    stopCountdown();
  }, []);

  const startCountdown = useCallback(() => {
    countdownCancelledRef.current = false;
    countdownStartRef.current = Date.now();
    setCountdownProgress(0);

    countdownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - countdownStartRef.current;
      const pct = Math.min(elapsed / COUNTDOWN_MS, 1);
      setCountdownProgress(pct);

      if (elapsed >= COUNTDOWN_MS) {
        stopCountdown();
        if (countdownCancelledRef.current) return;
        // Fire the call
        const lead = currentLeadRef.current;
        const camp = campaignRef.current;
        if (lead && camp && callStateRef.current === 'idle') {
          makeCall(lead.phone, { leadId: lead.id, campaignId: camp.id, callerId: selectedCallerId || camp.caller_id });
        }
      }
    }, COUNTDOWN_TICK_MS);
  }, [makeCall]);

  // ---------- lead fetching ----------
  const fetchNextLead = useCallback(async () => {
    if (fetchingLead) return;
    setFetchingLead(true);
    setQueueEmpty(false);
    setFetchError(null);
    try {
      const result = await api.getNextLead(campaignId);
      if (result.lead) {
        setCurrentLead(result.lead);
        setLeadData(result.lead.data || {});
      } else {
        setCurrentLead(null);
        setLeadData({});
        setQueueEmpty(true);
      }
    } catch (err) {
      console.error('Fetch lead error:', err);
      setFetchError('Failed to load next lead. Check your connection and try again.');
    } finally {
      setFetchingLead(false);
    }
  }, [campaignId, fetchingLead]);

  // Initial lead fetch after campaign loads
  useEffect(() => {
    if (campaign && !currentLead && !queueEmpty) fetchNextLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

  // ---------- auto-dial trigger: when a new lead arrives and we're idle ----------
  useEffect(() => {
    if (!autoDialActive) return;
    if (!currentLead) return;
    if (callState !== 'idle') return;
    if (connectionStatus !== 'connected') return;

    // Kill any previous countdown and start fresh for this lead
    cancelCountdown();
    countdownCancelledRef.current = false;

    if (autoDialDelayEnabled) {
      startCountdown();
    } else {
      makeCall(currentLead.phone, {
        leadId: currentLead.id,
        campaignId: campaign.id,
        callerId: activeCallerId()
      });
    }

    // Cleanup if lead changes or component unmounts mid-countdown
    return () => { cancelCountdown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead?.id, autoDialActive, autoDialDelayEnabled, connectionStatus]);

  // ---------- Escape hotkey: cancel countdown (current lead only) ----------
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (countdownProgress !== null) {
        cancelCountdown();
      }
      // During active call or idle: intentionally do nothing
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [countdownProgress, cancelCountdown]);

  function activeCallerId() {
    return selectedCallerId || campaign?.caller_id;
  }

  function getNextAutoRedialTime() {
    const DELAY_MS = 240 * 60 * 1000;
    const START_H = 9, END_H = 18;
    const d = new Date(Date.now() + DELAY_MS);
    for (let i = 0; i < 10; i++) {
      const day = d.getDay();
      const h = d.getHours();
      if (day === 0 || day === 6) {
        d.setDate(d.getDate() + (day === 0 ? 1 : 2));
        d.setHours(START_H, 0, 0, 0);
      } else if (h < START_H) { d.setHours(START_H, 0, 0, 0); break; }
      else if (h >= END_H) { d.setDate(d.getDate() + 1); d.setHours(START_H, 0, 0, 0); }
      else break;
    }
    return d.toISOString();
  }

  // ---------- manual actions ----------
  function dialLead() {
    if (!currentLead || callState !== 'idle') return;
    cancelCountdown();
    makeCall(currentLead.phone, {
      leadId: currentLead.id,
      campaignId: campaign.id,
      callerId: activeCallerId()
    });
  }

  async function saveLead(saveData) {
    if (!currentLead) return;
    // Hang up any active/ringing call. Safe no-op when already idle.
    hangup();
    try {
      await api.saveLead(currentLead.id, { ...saveData, data: leadData });
      setCurrentLead(null);
      setLeadData({});
      await fetchNextLead();
    } catch (err) {
      console.error('Save lead error:', err);
      alert('Failed to save lead');
    }
  }

  async function postponeLead() {
    if (!currentLead) return;
    await saveLead({ status: 'auto_redial', callback_time: getNextAutoRedialTime() });
  }

  function updateLeadField(key, value) {
    setLeadData(prev => ({ ...prev, [key]: value }));
  }

  // Cleanup countdown on unmount
  useEffect(() => () => stopCountdown(), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-calljet-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <PhoneBar
        lead={currentLead}
        campaign={campaign}
        onDial={dialLead}
        onHangup={hangup}
        onToggleActivity={() => setShowActivity(!showActivity)}
        showActivity={showActivity}
        isProgressive={isProgressive}
        autoDialEnabled={autoDialEnabled}
        setAutoDialEnabled={setAutoDialEnabled}
        autoDialDelayEnabled={autoDialDelayEnabled}
        setAutoDialDelayEnabled={setAutoDialDelayEnabled}
        countdownProgress={countdownProgress}
        phoneNumbers={phoneNumbers}
        selectedCallerId={selectedCallerId}
        setSelectedCallerId={setSelectedCallerId}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-auto">
          <div className="bg-white border-b px-6 py-2 flex items-center gap-1">
            <span className="text-sm font-medium text-gray-500 mr-4">
              Lead data {currentLead?.id && <span className="text-gray-400 text-xs ml-1">ID: {currentLead.id.slice(0, 8)}</span>}
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
              {fetchError ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-16">
                  <p className="text-base font-medium mb-2 text-red-600">{fetchError}</p>
                  <button onClick={fetchNextLead} className="btn-secondary text-sm mt-2">Retry</button>
                </div>
              ) : queueEmpty ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-16">
                  <p className="text-lg font-medium mb-2">Queue empty</p>
                  <p className="text-sm text-gray-400 mb-4">No more leads available in this campaign.</p>
                  <div className="flex gap-2">
                    <button onClick={fetchNextLead} className="btn-primary text-sm">Try again</button>
                    <button onClick={() => navigate('/')} className="btn-secondary text-sm">Back to dashboard</button>
                  </div>
                </div>
              ) : activeTab === 'data' ? (
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