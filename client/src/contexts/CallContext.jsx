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
  const ringCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);

  // Mirror state in refs so the Telnyx event listener (registered once in
  // connect) can read the latest values without stale closure issues.
  const currentCallRecordRef = useRef(null);
  const activeCallRef = useRef(null);

  useEffect(() => { currentCallRecordRef.current = currentCallRecord; }, [currentCallRecord]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  function startRingTone() {
    if (!ringCtxRef.current || ringCtxRef.current.state === 'closed') {
      ringCtxRef.current = new AudioContext();
    }
    const ctx = ringCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    function burst() {
      [400, 450].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0.07;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1);
      });
    }

    burst();
    ringIntervalRef.current = setInterval(burst, 5000);
  }

  function stopRingTone() {
    clearInterval(ringIntervalRef.current);
    ringIntervalRef.current = null;
    if (ringCtxRef.current) ringCtxRef.current.suspend().catch(() => {});
  }

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (callStartRef.current) setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // Stable handler (empty deps) that reads fresh values from refs.
  const handleCallUpdate = useCallback((call) => {
    setActiveCall(call);
    switch (call.state) {
      case 'trying':
      case 'requesting':
        setCallState('connecting');
        break;
      case 'recovering':
      case 'early':
        setCallState('ringing');
        startRingTone();
        break;
                
      case 'active':
        stopRingTone();
        setCallState('active');
        callStartRef.current = Date.now();
        startTimer();
        if (call.remoteStream && audioRef.current) {
          audioRef.current.srcObject = call.remoteStream;
          audioRef.current.play().catch(() => {});
        }
        break;
      case 'hangup':
      case 'destroy': {
        stopRingTone();
        stopTimer();
        setCallState('idle');
        setActiveCall(null);
        setIsMuted(false);
        const rec = currentCallRecordRef.current;
        const start = callStartRef.current;
        if (rec?.id) {
          const dur = start ? Math.floor((Date.now() - start) / 1000) : 0;
          api.updateCall(rec.id, {
            duration_seconds: dur,
            ended_at: new Date().toISOString(),
            disposition: dur > 0 ? 'answered' : 'no_answer'
          }).catch(console.error);
        }
        callStartRef.current = null;
        setCurrentCallRecord(null);
        setCallDuration(0);
        break;
      }
      default:
        break;
    }
  }, []);

  const connect = useCallback((sipUsername, sipPassword) => {
    if (client) client.disconnect();
    const c = new TelnyxRTC({
      login: sipUsername || import.meta.env.VITE_TELNYX_SIP_USERNAME,
      password: sipPassword || import.meta.env.VITE_TELNYX_SIP_PASSWORD
    });
    c.on('telnyx.ready', () => { console.log('Telnyx connected'); setConnectionStatus('connected'); });
    c.on('telnyx.error', (e) => { console.error('Telnyx error:', e); setConnectionStatus('error'); });
    c.on('telnyx.socket.close', () => { setConnectionStatus('disconnected'); });
    c.on('telnyx.notification', (n) => { if (n.call && n.type === 'callUpdate') handleCallUpdate(n.call); });
    c.connect();
    setClient(c);
  }, [client, handleCallUpdate]);

  const makeCall = useCallback(async (phoneNumber, { leadId, campaignId, callerId } = {}) => {
    if (!client || callState !== 'idle') return;
    if (!phoneNumber) { console.error('makeCall aborted: no phone number'); return; }
    try {
      const rec = await api.logCall({
        lead_id: leadId,
        campaign_id: campaignId,
        phone_number: phoneNumber,
        caller_id_used: callerId,
        direction: 'outbound'
      });
      // Sync ref before SDK call so any immediate event sees the record.
      currentCallRecordRef.current = rec;
      setCurrentCallRecord(rec);
      const call = client.newCall({
        destinationNumber: phoneNumber,
        callerNumber: callerId || import.meta.env.VITE_TELNYX_CALLER_ID,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16
        },
        video: false
      });
      
      activeCallRef.current = call;
      setActiveCall(call);
      setCallState('connecting');

      if (call.id) api.updateCall(rec.id, { telnyx_call_id: call.id }).catch(console.error);
    } catch (err) {
      console.error('Make call error:', err);
      setCallState('idle');
    }
  }, [client, callState]);

  const hangup = useCallback(() => {
    const ac = activeCallRef.current;
    if (ac) ac.hangup();
    setCallState('idle');
  }, []);

  const toggleMute = useCallback(() => {
    const ac = activeCallRef.current;
    if (!ac) return;
    isMuted ? ac.unmuteAudio() : ac.muteAudio();
    setIsMuted(!isMuted);
  }, [isMuted]);

  const sendDTMF = useCallback((d) => {
    const ac = activeCallRef.current;
    if (ac && callState === 'active') ac.dtmf(d);
  }, [callState]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
      setClient(null);
      setConnectionStatus('disconnected');
    }
  }, [client]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopRingTone();
      if (client) client.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatDuration(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  return (
    <CallContext.Provider value={{
      client, connect, disconnect, connectionStatus,
      callState, activeCall, callDuration,
      formattedDuration: formatDuration(callDuration),
      isMuted, makeCall, hangup, toggleMute, sendDTMF,
      currentCallRecord
    }}>
      <audio ref={audioRef} autoPlay playsInline />
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}