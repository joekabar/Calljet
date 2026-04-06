import { Router } from 'express';
import supabase from '../services/supabase.js';
import { sendToUser } from '../services/websocket.js';
const router = Router();

router.post('/telnyx/call', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = body.data;
    const eventType = event?.event_type;
    const payload = event?.payload;
    if (!eventType || !payload) return res.status(200).send('OK');

    console.log(`Telnyx webhook: ${eventType}`, payload?.call_control_id);
    const callControlId = payload?.call_control_id;
    const telnyxCallId = payload?.call_leg_id || payload?.call_session_id;

    let clientState = {};
    if (payload?.client_state) { try { clientState = JSON.parse(Buffer.from(payload.client_state, 'base64').toString()); } catch(e) {} }

    switch (eventType) {
      case 'call.initiated':
        if (clientState.userId) sendToUser(clientState.userId, { type: 'call_event', event: 'initiated', callControlId, telnyxCallId });
        break;
      case 'call.answered':
        if (telnyxCallId) await supabase.from('calls').update({ disposition: 'answered', answered_at: new Date().toISOString() }).eq('telnyx_call_id', telnyxCallId);
        if (clientState.userId) sendToUser(clientState.userId, { type: 'call_event', event: 'answered', callControlId });
        break;
      case 'call.hangup': {
        const duration = payload?.duration_secs || 0;
        const cause = payload?.hangup_cause;
        let disposition = 'answered';
        if (cause === 'NORMAL_CLEARING') disposition = duration > 0 ? 'answered' : 'no_answer';
        else if (cause === 'USER_BUSY') disposition = 'busy';
        else if (cause === 'NO_ANSWER') disposition = 'no_answer';
        else if (cause === 'CALL_REJECTED') disposition = 'failed';
        if (telnyxCallId) await supabase.from('calls').update({ disposition, duration_seconds: duration, ended_at: new Date().toISOString() }).eq('telnyx_call_id', telnyxCallId);
        if (clientState.userId) sendToUser(clientState.userId, { type: 'call_event', event: 'hangup', callControlId, disposition, duration });
        break;
      }
      case 'call.recording.saved': {
        const recordingUrl = payload?.recording_urls?.mp3;
        if (telnyxCallId && recordingUrl) await supabase.from('calls').update({ recording_url: recordingUrl, recording_status: 'completed' }).eq('telnyx_call_id', telnyxCallId);
        break;
      }
    }
    res.status(200).send('OK');
  } catch (err) { console.error('Webhook error:', err); res.status(200).send('OK'); }
});

export default router;
