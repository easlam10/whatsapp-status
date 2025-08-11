// api/webhook.js

// Simple in-memory store for opt-in tracking (replace with DB in production)
const optedInUsers = new Set();

export default async function handler(req, res) {
  // 1. Verification challenge (for initial WhatsApp webhook setup)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // 2. Handle incoming webhook events
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Incoming webhook:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];

        if (changes?.field === 'messages') {
          const value = changes.value;
          const msg = value?.messages?.[0];

          if (!msg) {
            console.log('No message found in webhook payload.');
            return res.status(200).send('EVENT_RECEIVED');
          }

          // --- Detect button clicks ---
          const isYesButton =
            (msg.type === 'button' && msg.button?.payload === 'Yes, send updates') ||
            (msg.interactive?.button_reply?.title === 'Yes, send updates');

          if (isYesButton) {
            console.log(`Button click detected from ${msg.from}`);

            // --- Prevent duplicate triggers ---
            if (!optedInUsers.has(msg.from)) {
              optedInUsers.add(msg.from);
              console.log(`First-time opt-in from ${msg.from} — triggering Heroku`);
              
              await runHerokuCommand();

              // Optional: confirmation message
              await sendWhatsAppMessage(msg.from, 'Thanks! Your updates are being prepared.');
            } else {
              console.log(`User ${msg.from} already opted in — no Heroku trigger`);
            }
          }

          // --- Detect status updates (delivered/read/failed) ---
          if (value?.statuses) {
            value.statuses.forEach(status => {
              console.log('STATUS_UPDATE:', {
                message_id: status.id,
                status: status.status,
                timestamp: new Date(status.timestamp * 1000),
                recipient: status.recipient_id,
                errors: status.errors
              });
            });
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).send('SERVER_ERROR');
    }
  }

  return res.status(405).send('Method Not Allowed');
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
          'Accept': 'application/vnd.heroku+json; version=3',
          'Authorization': `Bearer ${HEROKU_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: 'node src/index.js',
          attach: false,
          type: 'worker'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Heroku API ${response.status}: ${errorData.message}`);
    }

    console.log('Heroku command triggered successfully');
  } catch (error) {
    console.error('Heroku execution failed:', error);
  }
}

