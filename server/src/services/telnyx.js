import Telnyx from 'telnyx';
const client = new Telnyx({ apiKey: process.env.TELNYX_API_KEY });
export async function initiateCall({ to, from, connectionId, clientState, webhookUrl }) {
  const response = await client.calls.dial({ connection_id: connectionId || process.env.TELNYX_CONNECTION_ID, to, from: from || process.env.TELNYX_DEFAULT_CALLER_ID, client_state: Buffer.from(JSON.stringify(clientState || {})).toString('base64'), webhook_url: webhookUrl || `${process.env.SERVER_URL}/api/webhooks/telnyx/call` });
  return response.data;
}
export default client;
