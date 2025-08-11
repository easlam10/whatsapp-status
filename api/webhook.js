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
      console.log('Incoming webhook:', JSON.stringify(body, null, 2));
      
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        
        if (changes?.field === 'messages') {
          const message = changes.value?.messages?.[0];
          
          // Process button click
          if (message?.button?.text === "Yes, send updates") {
            console.log('✅ Button clicked - triggering Heroku');
            
            // Trigger Heroku command via API
            const herokuResponse = await triggerHerokuCommand();
            console.log('Heroku API response:', herokuResponse);
            
            // Simple math calculation demo
            const result = 5 + 3;
            console.log(`📊 Calculation: 5 + 3 = ${result}`);
          }
          
          // Process status updates
          const statuses = changes.value?.statuses || [];
          statuses.forEach(status => {
            console.log('📦 Status update:', {
              id: status.id,
              status: status.status,
              timestamp: new Date(status.timestamp * 1000)
            });
          });
        }
      }
      
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).send('SERVER_ERROR');
    }
  }

  return res.status(405).send('Method Not Allowed');
}

// Heroku API trigger function
async function triggerHerokuCommand() {
  const HEROKU_APP_NAME = 'ai-email-bot';
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





//   // api/webhook.js
// export default async function handler(req, res) {
//     // Verification challenge
//     if (req.method === 'GET') {
//       const mode = req.query['hub.mode'];
//       const token = req.query['hub.verify_token'];
//       const challenge = req.query['hub.challenge'];
      
//       if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
//         console.log('WEBHOOK_VERIFIED');
//         return res.status(200).send(challenge);
//       }
//       return res.status(403).send('Verification failed');
//     }
  
//     // Handle status updates
//     if (req.method === 'POST') {
//       try {
//         const body = req.body;
//         console.log('Webhook payload:', JSON.stringify(body, null, 2));
        
//         if (body.object === 'whatsapp_business_account') {
//           const entry = body.entry?.[0];
//           const changes = entry?.changes?.[0];
          
//           if (changes?.field === 'messages') {
//             const statuses = changes.value?.statuses || [];
            
//             statuses.forEach(status => {
//               console.log('STATUS_UPDATE', {
//                 message_id: status.id,
//                 status: status.status, // sent, delivered, read, failed
//                 timestamp: new Date(status.timestamp * 1000),
//                 recipient_id: status.recipient_id,
//                 errors: status.errors
//               });
//             });
//           }
//         }
        
//         return res.status(200).send('EVENT_RECEIVED');
//       } catch (error) {
//         console.error('Webhook error:', error);
//         return res.status(500).send('SERVER_ERROR');
//       }
//     }
  
//     return res.status(405).send('Method Not Allowed');
//   }