// api/webhook.js
export default async function handler(req, res) {
  // Verification challenge
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

  // Handle incoming events
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Incoming webhook:', JSON.stringify(body, null, 2));
      
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        
        // Handle message status updates
        if (changes?.field === 'messages') {
          const value = changes.value;
          
          // 1. Process message statuses (delivered/read/failed)
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
          
          // 2. Process button clicks
          if (value?.messages?.[0]?.interactive?.button_reply?.title === "Yes, get updates") {
            console.log('OPT-IN RECEIVED - Triggering Heroku');
            await runHerokuCommand();
            
            // Optional: Send confirmation message
            await sendWhatsAppMessage(
              value.messages[0].from, 
              "Thanks! Your updates are being prepared."
            );
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

// Helper function to execute Heroku command
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
          type: 'worker' // Use worker dyno type if available
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
    // Consider retry logic here
  }
}
