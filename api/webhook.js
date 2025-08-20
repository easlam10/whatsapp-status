// Vercel serverless function with WhatsApp verification and dual-command support
module.exports = async (req, res) => {
  console.log('=== INCOMING REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // WhatsApp webhook verification
  if (req.method === 'GET') {
    console.log('GET request - Webhook verification');
    console.log('Query parameters:', req.query);
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`Verification attempt: mode=${mode}, token=${token}`);
    
    if (mode && token && process.env.WHATSAPP_VERIFY_TOKEN === token) {
      console.log('Webhook verification SUCCESSFUL');
      return res.status(200).send(challenge);
    }
    
    console.log('Webhook verification FAILED');
    return res.status(403).send('Verification failed');
  }

  // Handle POST requests (actual messages)
  if (req.method !== 'POST') {
    console.log(`Invalid method: ${req.method}`);
    return res.status(405).send('Method Not Allowed');
  }

  try {
    console.log('POST request - Processing message');
    const payload = req.body;
    console.log('Request body:', JSON.stringify(payload, null, 2));
    
    // Verify webhook secret if set
    if (process.env.WEBHOOK_SECRET && req.headers['x-hub-signature'] !== process.env.WEBHOOK_SECRET) {
      console.log('Invalid signature provided');
      return res.status(401).send('Invalid signature');
    }

    // Extract button click information
    const buttonClick = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button;
    console.log('Button click extracted:', buttonClick);
    
    if (!buttonClick) {
      console.log('No button interaction found');
      
      // Log the full structure to understand what's actually coming in
      console.log('Full entry structure:', JSON.stringify(payload?.entry, null, 2));
      console.log('Messages found:', payload?.entry?.[0]?.changes?.[0]?.value?.messages);
      
      return res.status(200).json({ status: 'No button interaction' });
    }

    const buttonText = buttonClick.text;
    console.log(`Button text: "${buttonText}"`);
    
    let HEROKU_APP_NAME;

    // Determine which command to run based on button text
    if (buttonText === 'Update Email Prefs') {
      HEROKU_APP_NAME = 'ai-email-bot';
      console.log('Selected ai-email-bot');
    } else if (buttonText === 'Adjust Edtech') {
      HEROKU_APP_NAME = 'edtech-scraper';
      console.log('Selected edtech-scraper');
    } else {
      console.log(`Unrecognized button command: "${buttonText}"`);
      return res.status(200).json({ status: 'Unrecognized button command' });
    }

    console.log(`Triggering Heroku command for: ${HEROKU_APP_NAME}`);
    
    // Trigger Heroku command
    const herokuResponse = await triggerHerokuCommand(HEROKU_APP_NAME);
    
    console.log('Heroku response received:', JSON.stringify(herokuResponse, null, 2));
    
    return res.status(200).json({
      status: `Command triggered for ${HEROKU_APP_NAME}`,
      heroku_response: herokuResponse
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Your EXACT Heroku command trigger function (modified for app parameter)
async function triggerHerokuCommand(HEROKU_APP_NAME) {
  console.log(`Starting Heroku command for: ${HEROKU_APP_NAME}`);
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;

  // Check if API key is available
  if (!HEROKU_API_KEY) {
    console.error('HEROKU_API_KEY environment variable is not set');
    throw new Error('Heroku API key not configured');
  }

  try {
    console.log(`Making API call to Heroku for app: ${HEROKU_APP_NAME}`);
    
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

    console.log(`Heroku API response status: ${response.status}`);
    
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
    console.error('Error details:', error.message);
    throw error;
  }
}