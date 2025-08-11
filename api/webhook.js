// api/webhook.js
import getRawBody from 'raw-body';

export const config = {
  api: { bodyParser: false }, // Required for raw-body parsing on Vercel
};

// In-memory store for opt-in tracking
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

// --- GET: Verification Challenge (UNCHANGED FROM WORKING VERSION) ---
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

// --- POST: Handle Incoming Events (ORIGINAL WORKING LOGIC) ---
async function handleWebhook(req, res) {
  try {
    const raw = await getRawBody(req);
    const body = JSON.parse(raw.toString('utf8'));

    console.log('Full payload:', JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).send('IGNORED');
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];

    // EXACTLY HOW YOUR WORKING VERSION PROCESSED MESSAGES
    if (changes?.field === 'messages' && changes.value?.messages?.[0]) {
      const message = changes.value.messages[0];
      const phoneNumber = message.from;

      console.log('Message received from:', phoneNumber);
      console.log('Full message:', JSON.stringify(message, null, 2));

      // 1. CHECK FOR BUTTON CLICK (ORIGINAL WORKING LOGIC)
      let userConsented = false;
      
      if (message.interactive?.button_reply?.title) {
        const buttonTitle = message.interactive.button_reply.title;
        console.log('Button click detected:', buttonTitle);
        
        // Original matching logic that worked
        if (buttonTitle.toLowerCase().includes('yes') || buttonTitle === 'Y') {
          userConsented = true;
        }
      }
      // 2. CHECK FOR TEXT MESSAGE (ORIGINAL WORKING LOGIC)
      else if (message.type === 'text' && message.text?.body) {
        const text = message.text.body.trim().toLowerCase();
        console.log('Text message received:', text);
        
        // Original matching logic that worked
        if (text.includes('yes') || text === 'y' || text === '1') {
          userConsented = true;
        }
      }

      // 3. PROCESS CONSENT (ORIGINAL WORKING LOGIC)
      if (userConsented) {
        console.log(`User ${phoneNumber} consented - triggering Heroku`);
        
        if (!optedInUsers.has(phoneNumber)) {
          optedInUsers.add(phoneNumber);
          await runHerokuCommand(); // Your working Heroku trigger
        }
      }
    }

    // Process status updates (new addition)
    if (changes?.value?.statuses) {
      changes.value.statuses.forEach(status => {
        console.log('Status update:', {
          id: status.id,
          status: status.status,
          timestamp: new Date(status.timestamp * 1000)
        });
      });
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).send('SERVER_ERROR');
  }
}

// --- Your working Heroku trigger (UNCHANGED) ---
async function runHerokuCommand() {
  const HEROKU_APP_NAME = 'edtech-scraper';
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  try {
    console.log('Triggering Heroku command...');
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

    if (!response.ok) throw new Error(`Heroku API ${response.status}`);
    console.log('Heroku command triggered successfully');
  } catch (error) {
    console.error('Heroku trigger failed:', error);
  }
}