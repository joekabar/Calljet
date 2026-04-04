import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user, profile } = useAuth();
  const [client, setClient] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, connecting, ringing, active, hangup
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallRecord, setCurrentCallRecord] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const timerRef = useRef(null);
  const callStartRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize Telnyx client
  const connect = useCallback((sipUsername, sipPassword) => {
    if (client) {
      client.disconnect();
    }

    const newClient = new TelnyxRTC({
      login: sipUsername || import.meta.env.VITE_TELNYX_SIP_USERNAME,
      password: sipPassword || import.meta.env.VITE_TELNYX_SIP_PASSWORD,
      ringtoneFile: '/ringtone.mp3',
      ringbackFile: '/ringback.mp3',
    });

    newClient.on('telnyx.ready', () => {
      console.log('Telnyx WebRTC connected');
      setConnectionStatus('connected');
    });

    newClient.on('telnyx.error', (error) => {
      console.error('Telnyx error:', error);
      setConnectionStatus('error');
    });

    newClient.on('telnyx.socket.close', () => {
      console.log('Telnyx disconnected');
      setConnectionStatus('disconnected');
    });

    newClient.on('telnyx.notification', (notification) => {
      const call = notification.call;
      if (!call) return;

      switch (notification.type) {
        case 'callUpdate':
          handleCallUpdate(call);
          break;
        case 'userMediaError':
          console.error('Media error - check microphone permissions');
          break;
      }
    });

    newClient.connect();
    setClient(newClient);
  }, [client]);

  // Handle call state updates from Telnyx
  function handleCallUpdate(call) {
    setActiveCall(call);

    switch (call.state) {
      case 'trying':
      case 'requesting':
        setCallState('connecting');
        break;
      case 'recovering':
      case 'early':
        setCallState('ringing');
        break;
      case 'active':
        setCallState('active');
        callStartRef.current = Date.now();
        startTimer();

        // Attach remote audio
        if (call.remoteStream && audioRef.current) {
          audioRef.current.srcObject = call.remoteStream;
          audioRef.current.play().catch(() => {});
        }
        break;
      case 'hangup':
      case 'destroy':
        setCallState('idle');
        stopTimer();
        setActiveCall(null);
        setIsMuted(false);

        // Update call record with final duration
        if (currentCallRecord?.id) {
          const duration = callStartRef.current
            ? Math.floor((Date.now() - callStartRef.current) / 1000)
            : 0;
          api.updateCall(currentCallRecord.id, {
            duration_seconds: duration,
            ended_at: new Date().toISOString(),
            disposition: duration > 0 ? 'answered' : 'no_answer'
          }).catch(console.error);
        }

        callStartRef.current = null;
        setCurrentCallRecord(null);
        setCallDuration(0);
        break;
      default:
        break;
    }
  }

  // Make a call
  const makeCall = useCallback(async (phoneNumber, { leadId, campaignId, callerId } = {}) => {
    if (!client || callState !== 'idle') return;

    try {
      // Log call in database first
      const callRecord = await api.logCall({
        lead_id: leadId,
        campaign_id: campaignId,
        phone_number: phoneNumber,
        caller_id_used: callerId,
        direction: 'outbound'
      });
      setCurrentCallRecord(callRecord);

      // Initiate WebRTC call
      const call = client.newCall({
        destinationNumber: phoneNumber,
        callerNumber: callerId || import.meta.env.VITE_TELNYX_CALLER_ID,
        audio: true,
        video: false,
      });

      setActiveCall(call);
      setCallState('connecting');

      // Update call record with telnyx ID once available
      if (call.id) {
        api.updateCall(callRecord.id, { telnyx_call_id: call.id }).catch(console.error);
      }
    } catch (err) {
      console.error('Make call error:', err);
      setCallState('idle');
    }
  }, [client, callState]);

  // Hang up
  const hangup = useCallback(() => {
    if (activeCall) {
      activeCall.hangup();
    }
    setCallState('idle');
  }, [activeCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!activeCall) return;
    if (isMuted) {
      activeCall.unmuteAudio();
    } else {
      activeCall.muteAudio();
    }
    setIsMuted(!isMuted);
  }, [activeCall, isMuted]);

  // Send DTMF
  const sendDTMF = useCallback((digit) => {
    if (activeCall && callState === 'active') {
      activeCall.dtmf(digit);
    }
  }, [activeCall, callState]);

  // Timer
  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (callStartRef.current) {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Disconnect on unmount
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
      if (client) client.disconnect();
    };
  }, []);

  // Format duration as mm:ss
  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <CallContext.Provider value={{
      client,
      connect,
      disconnect,
      connectionStatus,
      callState,
      activeCall,
      callDuration,
      formattedDuration: formatDuration(callDuration),
      isMuted,
      makeCall,
      hangup,
      toggleMute,
      sendDTMF,
      currentCallRecord
    }}>
      {/* Hidden audio element for remote stream */}
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
