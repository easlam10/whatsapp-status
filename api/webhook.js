// api/webhook.js
import getRawBody from 'raw-body';

export const config = {
  api: { bodyParser: false },
};

const optedInUsers = new Set();

export default async function handler(req, res) {
  if (req.method === 'GET') return verifyWebhook(req, res);
  if (req.method === 'POST') return handleWebhook(req, res);
  return res.status(405).send('Method Not Allowed');
}

function verifyWebhook(req, res) {
  const { mode, verify_token: token, challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.warn('❌ Verification failed');
  return res.status(403).send('Verification failed');
}

async function handleWebhook(req, res) {
  try {
    const body = JSON.parse((await getRawBody(req)).toString('utf8'));
    console.log('📦 Full payload:', JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).send('IGNORED');
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      console.log('ℹ️ No message found');
      return res.status(200).send('EVENT_RECEIVED');
    }

    console.log('✉️ Message details:', {
      type: message.type,
      from: message.from,
      button: message.button,
      interactive: message.interactive
    });

    // Handle button click (NEW FIXED VERSION)
    if (message.type === 'button' && message.button?.text === 'Yes, send updates') {
      console.log('🎯 "Yes, send updates" button clicked');
      
      if (!optedInUsers.has(message.from)) {
        optedInUsers.add(message.from);
        console.log('🚀 Triggering Heroku command...');
        await runHerokuCommand();
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return res.status(500).send('SERVER_ERROR');
  }
}

async function runHerokuCommand() {
  try {
    const response = await fetch(
      `https://api.heroku.com/apps/edtech-scraper/dynos`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.heroku+json; version=3',
          'Authorization': `Bearer ${process.env.HEROKU_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: 'node src/index.js',
          attach: false,
          type: 'worker'
        })
      }
    );

    if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
    console.log('🎉 Heroku command triggered');
  } catch (error) {
    console.error('❌ Heroku error:', error);
  }
}