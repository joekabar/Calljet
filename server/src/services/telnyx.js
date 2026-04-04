import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env.TELNYX_API_KEY,
});

export async function initiateCall({ to, from, connectionId, clientState, webhookUrl }) {
  try {
    const response = await client.calls.dial({
      connection_id: connectionId || process.env.TELNYX_CONNECTION_ID,
      to,
      from: from || process.env.TELNYX_DEFAULT_CALLER_ID,
      client_state: Buffer.from(JSON.stringify(clientState || {})).toString('base64'),
      webhook_url: webhookUrl || `${process.env.SERVER_URL}/api/webhooks/telnyx/call`,
    });
    return response.data;
  } catch (error) {
    console.error('Telnyx call error:', error);
    throw error;
  }
}

export async function hangupCall(callControlId) {
  try {
    await client.calls.hangup(callControlId);
  } catch (error) {
    console.error('Telnyx hangup error:', error);
    throw error;
  }
}

export async function startRecording(callControlId) {
  try {
    await client.calls.recordStart(callControlId, {
      format: 'mp3',
      channels: 'dual',
    });
  } catch (error) {
    console.error('Telnyx recording error:', error);
    throw error;
  }
}

export async function stopRecording(callControlId) {
  try {
    await client.calls.recordStop(callControlId);
  } catch (error) {
    console.error('Telnyx stop recording error:', error);
    throw error;
  }
}

export async function sendDTMF(callControlId, digits) {
  try {
    await client.calls.dtmf(callControlId, { digits });
  } catch (error) {
    console.error('Telnyx DTMF error:', error);
    throw error;
  }
}

export default client;