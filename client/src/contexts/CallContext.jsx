import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user, profile } = useAuth();
  const [client, setClient] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallRecord, setCurrentCallRecord] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const timerRef = useRef(null);
  const callStartRef = useRef(null);
  const audioRef = useRef(null);

  const connect = useCallback((sipUsername, sipPassword) => {
    if (client) client.disconnect();
    const c = new TelnyxRTC({ login: sipUsername || import.meta.env.VITE_TELNYX_SIP_USERNAME, password: sipPassword || import.meta.env.VITE_TELNYX_SIP_PASSWORD });
    c.on('telnyx.ready', () => { console.log('Telnyx connected'); setConnectionStatus('connected'); });
    c.on('telnyx.error', (e) => { console.error('Telnyx error:', e); setConnectionStatus('error'); });
    c.on('telnyx.socket.close', () => { setConnectionStatus('disconnected'); });
    c.on('telnyx.notification', (n) => { if (n.call && n.type === 'callUpdate') handleCallUpdate(n.call); });
    c.connect();
    setClient(c);
  }, [client]);

  function handleCallUpdate(call) {
    setActiveCall(call);
    switch (call.state) {
      case 'trying': case 'requesting': setCallState('connecting'); break;
      case 'recovering': case 'early': setCallState('ringing'); break;
      case 'active':
        setCallState('active'); callStartRef.current = Date.now(); startTimer();
        if (call.remoteStream && audioRef.current) { audioRef.current.srcObject = call.remoteStream; audioRef.current.play().catch(() => {}); }
        break;
      case 'hangup': case 'destroy':
        setCallState('idle'); stopTimer(); setActiveCall(null); setIsMuted(false);
        if (currentCallRecord?.id) {
          const dur = callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : 0;
          api.updateCall(currentCallRecord.id, { duration_seconds: dur, ended_at: new Date().toISOString(), disposition: dur > 0 ? 'answered' : 'no_answer' }).catch(console.error);
        }
        callStartRef.current = null; setCurrentCallRecord(null); setCallDuration(0);
        break;
    }
  }

  const makeCall = useCallback(async (phoneNumber, { leadId, campaignId, callerId } = {}) => {
    if (!client || callState !== 'idle') return;
    try {
      const rec = await api.logCall({ lead_id: leadId, campaign_id: campaignId, phone_number: phoneNumber, caller_id_used: callerId, direction: 'outbound' });
      setCurrentCallRecord(rec);
      const call = client.newCall({ destinationNumber: phoneNumber, callerNumber: callerId || import.meta.env.VITE_TELNYX_CALLER_ID, audio: true, video: false });
      setActiveCall(call); setCallState('connecting');
      if (call.id) api.updateCall(rec.id, { telnyx_call_id: call.id }).catch(console.error);
    } catch (err) { console.error('Make call error:', err); setCallState('idle'); }
  }, [client, callState]);

  const hangup = useCallback(() => { if (activeCall) activeCall.hangup(); setCallState('idle'); }, [activeCall]);
  const toggleMute = useCallback(() => { if (!activeCall) return; isMuted ? activeCall.unmuteAudio() : activeCall.muteAudio(); setIsMuted(!isMuted); }, [activeCall, isMuted]);
  const sendDTMF = useCallback((d) => { if (activeCall && callState === 'active') activeCall.dtmf(d); }, [activeCall, callState]);

  function startTimer() { stopTimer(); timerRef.current = setInterval(() => { if (callStartRef.current) setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000)); }, 1000); }
  function stopTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
  const disconnect = useCallback(() => { if (client) { client.disconnect(); setClient(null); setConnectionStatus('disconnected'); } }, [client]);
  useEffect(() => { return () => { stopTimer(); if (client) client.disconnect(); }; }, []);
  function formatDuration(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }

  return (
    <CallContext.Provider value={{ client, connect, disconnect, connectionStatus, callState, activeCall, callDuration, formattedDuration: formatDuration(callDuration), isMuted, makeCall, hangup, toggleMute, sendDTMF, currentCallRecord }}>
      <audio ref={audioRef} autoPlay playsInline />{children}
    </CallContext.Provider>
  );
}

export function useCall() { const ctx = useContext(CallContext); if (!ctx) throw new Error('useCall must be used within CallProvider'); return ctx; }
