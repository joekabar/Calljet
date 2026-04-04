import Telnyx from 'telnyx';

const telnyx = Telnyx(process.env.TELNYX_API_KEY);

export async function initiateCall({ to, from, connectionId, clientState }) {
  try {
    const call = await telnyx.calls.create({
      connection_id: connectionId || process.env.TELNYX_CONNECTION_ID,
      to,
      from: from || process.env.TELNYX_DEFAULT_CALLER_ID,
      client_state: Buffer.from(JSON.stringify(clientState || {})).toString('base64'),
      webhook_url: `${process.env.SERVER_URL}/api/webhooks/telnyx/call`,
    });
    return call.data;
  } catch (error) {
    console.error('Telnyx call error:', error);
    throw error;
  }
}

export async function hangupCall(callControlId) {
  try {
    await telnyx.calls.hangup(callControlId);
  } catch (error) {
    console.error('Telnyx hangup error:', error);
    throw error;
  }
}

export async function startRecording(callControlId) {
  try {
    await telnyx.calls.record_start(callControlId, {
      format: 'mp3',
      channels: 'dual'
    });
  } catch (error) {
    console.error('Telnyx recording error:', error);
    throw error;
  }
}

export async function stopRecording(callControlId) {
  try {
    await telnyx.calls.record_stop(callControlId);
  } catch (error) {
    console.error('Telnyx stop recording error:', error);
    throw error;
  }
}

export async function sendDTMF(callControlId, digits) {
  try {
    await telnyx.calls.dtmf(callControlId, { digits });
  } catch (error) {
    console.error('Telnyx DTMF error:', error);
    throw error;
  }
}

export async function muteCall(callControlId) {
  try {
    await telnyx.calls.mute(callControlId);
  } catch (error) {
    console.error('Telnyx mute error:', error);
    throw error;
  }
}

export async function unmuteCall(callControlId) {
  try {
    await telnyx.calls.unmute(callControlId);
  } catch (error) {
    console.error('Telnyx unmute error:', error);
    throw error;
  }
}

export default telnyx;
