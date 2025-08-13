// Vercel serverless function with WhatsApp verification and dual-command support
module.exports = async (req, res) => {
  // WhatsApp webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && process.env.WHATSAPP_VERIFY_TOKEN === token) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // Handle POST requests (actual messages)
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const payload = req.body;
    
    // Verify webhook secret if set
    if (process.env.WEBHOOK_SECRET && req.headers['x-hub-signature'] !== process.env.WEBHOOK_SECRET) {
      return res.status(401).send('Invalid signature');
    }

    // Extract button click information
    const buttonClick = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button;
    if (!buttonClick) {
      return res.status(200).json({ status: 'No button interaction' });
    }

    const buttonText = buttonClick.text;
    let HEROKU_APP_NAME;

    // Determine which command to run based on button text
    if (buttonText === 'Send email updates') {
      HEROKU_APP_NAME = 'ai-email-bot';
    } else if (buttonText === 'Send edtech updates') {
      HEROKU_APP_NAME = 'edtech-scraper';
    } else {
      return res.status(200).json({ status: 'Unrecognized button command' });
    }

    // Trigger Heroku command
    const herokuResponse = await triggerHerokuCommand(HEROKU_APP_NAME);
    
    return res.status(200).json({
      status: `Command triggered for ${HEROKU_APP_NAME}`,
      heroku_response: herokuResponse
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Your EXACT Heroku command trigger function (modified for app parameter)
async function triggerHerokuCommand(HEROKU_APP_NAME) {
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
      throw new Error(`Heroku API ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Heroku trigger failed:', error);
    throw error;
  }
}