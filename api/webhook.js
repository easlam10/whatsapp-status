// api/webhook.js
import getRawBody from 'raw-body';

export const config = {
  api: { bodyParser: false }, // Required for raw-body parsing on Vercel
};

// In-memory store for opt-in tracking (replace with DB in production)
const optedInUsers = new Set();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return verifyWebhook(req, res);
  }

  if (req.method === 'POST') {
    return handleWebhook(req, res);
  }

  res.status(405).send('Method Not Allowed');
}

// --- GET: Verification Challenge ---
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification failed', { mode, token });
  return res.status(403).send('Verification failed');
}

// --- POST: Handle Incoming Events ---
async function handleWebhook(req, res) {
  try {
    const raw = await getRawBody(req);
    const body = JSON.parse(raw.toString('utf8'));

    console.log('Webhook payload received:', JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      console.warn('Unexpected object type:', body.object);
      return res.status(200).send('IGNORED');
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];

    if (changes?.field !== 'messages') {
      console.log('Non-message change received:', changes?.field);
      return res.status(200).send('IGNORED');
    }

    const value = changes.value;
    const msg = value?.messages?.[0];

    if (!msg) {
      console.log('No message found in webhook payload.');
      return res.status(200).send('EVENT_RECEIVED');
    }

    logMessageDetails(msg);

    const isYesButton = detectYesButton(msg);
    console.log('isYesButton result:', isYesButton);

    if (isYesButton) {
      if (!optedInUsers.has(msg.from)) {
        optedInUsers.add(msg.from);
        console.log(`✅ First-time opt-in from ${msg.from} — triggering Heroku`);
        await runHerokuCommand();
      } else {
        console.log(`⚠️ User ${msg.from} already opted in — skipping trigger`);
      }
    } else {
      console.log('No matching "Yes, send updates" button detected.');
    }

    logStatusUpdates(value?.statuses);

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).send('SERVER_ERROR');
  }
}

// --- Utility: Log message details ---
function logMessageDetails(msg) {
  console.log('Message type:', msg.type);
  console.log('From:', msg.from);
  if (msg.button) {
    console.log('Button payload:', msg.button?.payload);
    console.log('Button text:', msg.button?.text);
  }
  if (msg.interactive?.button_reply) {
    console.log('Interactive button title:', msg.interactive.button_reply?.title);
    console.log('Interactive button id:', msg.interactive.button_reply?.id);
  }
}

// --- Utility: Detect "Yes, send updates" ---
function detectYesButton(msg) {
  const target = 'yes, send updates';

  if (msg.type === 'button') {
    const payload = msg.button?.payload?.trim().toLowerCase();
    return payload === target;
  }

  if (msg.type === 'interactive' && msg.interactive?.button_reply?.title) {
    const title = msg.interactive.button_reply.title.trim().toLowerCase();
    return title === target;
  }

  return false;
}

// --- Utility: Log status updates ---
function logStatusUpdates(statuses) {
  if (!statuses) return;
  statuses.forEach(status => {
    console.log('STATUS_UPDATE:', {
      message_id: status.id,
      status: status.status,
      timestamp: new Date(status.timestamp * 1000),
      recipient: status.recipient_id,
      errors: status.errors,
    });
  });
}

// --- Trigger a Heroku dyno ---
async function runHerokuCommand() {
  const HEROKU_APP_NAME = 'edtech-scraper';
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  try {
    const response = await fetch(
      `https://api.heroku.com/apps/${HEROKU_APP_NAME}/dynos`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.heroku+json; version=3',
          Authorization: `Bearer ${HEROKU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'node src/index.js',
          attach: false,
          type: 'worker',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Heroku API ${response.status}: ${errorData.message}`);
    }

    console.log('🚀 Heroku command triggered successfully');
  } catch (error) {
    console.error('❌ Heroku execution failed:', error);
  }
}
