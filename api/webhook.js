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

  // Handle POST events
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Incoming webhook payload:', JSON.stringify(body, null, 2));
      
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        
        if (changes?.field === 'messages') {
          const message = changes.value?.messages?.[0];
          
          // 1. Process button click
          if (message?.button?.text === "Yes, send updates") {
            console.log('✅ "Yes, send updates" button clicked!');
            
            // Simple math calculation (example: 5 + 3)
            const result = 5 + 3;
            console.log(`📊 Math calculation: 5 + 3 = ${result}`);
            
            // Add your custom logic here
            // await triggerHerokuCommand(); // Uncomment if needed
          }
          
          // 2. Process status updates (existing code)
          const statuses = changes.value?.statuses || [];
          statuses.forEach(status => {
            console.log('STATUS_UPDATE', {
              message_id: status.id,
              status: status.status,
              timestamp: new Date(status.timestamp * 1000),
              recipient_id: status.recipient_id,
              errors: status.errors
            });
          });
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