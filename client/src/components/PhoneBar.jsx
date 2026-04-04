import { useState } from 'react';
import { useCall } from '../contexts/CallContext';
import { Phone, PhoneOff, Mic, MicOff, Grid3X3, Pause, Play, ChevronDown, Activity } from 'lucide-react';

export default function PhoneBar({ lead, campaign, onDial, onHangup, onToggleActivity, showActivity }) {
  const { callState, formattedDuration, isMuted, toggleMute, sendDTMF, connectionStatus } = useCall();
  const [showKeypad, setShowKeypad] = useState(false);

  const isIdle = callState === 'idle';
  const isConnecting = callState === 'connecting' || callState === 'ringing';
  const isActive = callState === 'active';
  const canDial = isIdle && lead && connectionStatus === 'connected';

  const dtmfKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  function getStatusColor() {
    if (isActive) return 'bg-green-500';
    if (isConnecting) return 'bg-amber-500';
    return 'bg-gray-400';
  }

  function getStatusText() {
    if (isActive) return 'Connected';
    if (isConnecting) return 'Dialing...';
    if (connectionStatus !== 'connected') return 'Not connected';
    return 'Ready';
  }

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Phone number display */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="font-mono text-sm font-medium text-gray-700">
              {lead?.phone || '---'}
            </span>
          </div>
        </div>

        {/* Call timer */}
        <div className="call-timer text-sm font-mono text-gray-500 w-16 text-center">
          {isActive || isConnecting ? formattedDuration : '00:00'}
        </div>

        {/* Call button */}
        {isIdle ? (
          <button
            onClick={onDial}
            disabled={!canDial}
            className="btn-call"
            title="Call"
          >
            <Phone className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onHangup}
            className="btn-hangup"
            title="Hang up"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        )}

        {/* Mute */}
        <button
          onClick={toggleMute}
          disabled={!isActive}
          className={`p-2.5 rounded-full transition-colors ${
            isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } disabled:opacity-30`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Keypad toggle */}
        <div className="relative">
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            disabled={!isActive}
            className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-30"
            title="Keypad"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          {showKeypad && (
            <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-lg border p-3 z-50">
              <div className="grid grid-cols-3 gap-1">
                {dtmfKeys.map(key => (
                  <button
                    key={key}
                    onClick={() => sendDTMF(key)}
                    className="w-12 h-12 rounded-lg bg-gray-50 hover:bg-gray-100 text-lg font-medium transition-colors"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`status-badge ${
              isActive ? 'bg-green-100 text-green-700' :
              isConnecting ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {getStatusText()}
            </span>
            {campaign?.caller_id && (
              <span className="text-xs text-gray-400">
                Caller ID: {campaign.caller_id}
              </span>
            )}
          </div>
        </div>

        {/* Activity toggle */}
        <button
          onClick={onToggleActivity}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            showActivity ? 'bg-calljet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Activity
        </button>
      </div>
    </div>
  );
}
