const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Add detailed request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INCOMING ${req.method} ${req.path}`, {
    headers: req.headers,
    query: req.query,
    body: req.body
  });
  next();
});



// WhatsApp webhook verification - GET endpoint
app.get('/webhook', (req, res) => {
  console.log('Webhook verification request received:', req.query);
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && process.env.WHATSAPP_VERIFY_TOKEN === token) {
    console.log('Webhook verification successful');
    return res.status(200).send(challenge);
  }
  
  console.log('Webhook verification failed');
  return res.status(403).send('Verification failed');
});

// Handle POST requests (actual messages)
app.post('/webhook', async (req, res) => {
  console.log('Webhook POST received:', JSON.stringify(req.body, null, 2));
  
  try {
    const payload = req.body;
    
    // Verify webhook secret if set
    if (process.env.WEBHOOK_SECRET && req.headers['x-hub-signature'] !== process.env.WEBHOOK_SECRET) {
      console.log('Invalid signature provided');
      return res.status(401).send('Invalid signature');
    }

    // Extract button click information
    const buttonClick = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button;
    if (!buttonClick) {
      console.log('No button interaction found in payload');
      return res.status(200).json({ status: 'No button interaction' });
    }

    const buttonText = buttonClick.text;
    let HEROKU_APP_NAME;

    console.log(`Button clicked: ${buttonText}`);

    // Determine which command to run based on button text
    if (buttonText === 'Update Email Prefs') {
      HEROKU_APP_NAME = 'ai-email-bot';
    } else if (buttonText === 'Adjust Edtech') {
      HEROKU_APP_NAME = 'edtech-scraper';
    } else {
      console.log(`Unrecognized button command: ${buttonText}`);
      return res.status(200).json({ status: 'Unrecognized button command' });
    }

    console.log(`Triggering Heroku command for: ${HEROKU_APP_NAME}`);
    
    // Trigger Heroku command
    const herokuResponse = await triggerHerokuCommand(HEROKU_APP_NAME);
    
    console.log(`Heroku response: ${JSON.stringify(herokuResponse)}`);
    
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
});

// Heroku command trigger function
async function triggerHerokuCommand(HEROKU_APP_NAME) {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  // For testing, just return a mock response if no API key is set
  if (!HEROKU_API_KEY) {
    console.log('No Heroku API key set, returning mock response');
    return { status: 'mock', message: 'No API key configured' };
  }

  try {
    console.log(`Making Heroku API call to app: ${HEROKU_APP_NAME}`);
    
    // Use dynamic import for fetch (Node 18+ has fetch built-in)
    let fetch;
    if (typeof globalThis.fetch === 'function') {
      fetch = globalThis.fetch;
    } else {
      fetch = (await import('node-fetch')).default;
    }
    
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
      const errorText = await response.text();
      console.error(`Heroku API error: ${response.status} - ${errorText}`);
      throw new Error(`Heroku API ${response.status}: ${errorText}`);
    }
    
    const responseData = await response.json();
    console.log('Heroku API call successful');
    return responseData;
    
  } catch (error) {
    console.error('Heroku trigger failed:', error);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`=================================`);
  console.log(`Server running on port ${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/webhook`);

});