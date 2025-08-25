// Vercel serverless function with WhatsApp verification and user-specific sending
module.exports = async (req, res) => {
  // Webhook verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && process.env.WHATSAPP_VERIFY_TOKEN === token) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const payload = req.body;

    // Extract user wa_id and button text
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const wa_id = message?.from; // ✅ this is the user number
    const buttonClick = message?.button;

    console.log("📩 Incoming payload:", JSON.stringify(payload, null, 2));

    if (!buttonClick || !wa_id) {
      console.log("ℹ️ No button interaction or wa_id missing");
      return res.status(200).json({ status: "No button interaction" });
    }

    const buttonText = buttonClick.text;
    console.log(`👉 Button: "${buttonText}", From: ${wa_id}`);

    let HEROKU_APP_NAME;
    if (buttonText === "Email Information") {
      HEROKU_APP_NAME = "ai-email-bot";
    } else if (buttonText === "Edtech Information") {
      HEROKU_APP_NAME = "edtech-scraper";
    } else {
      console.log(`⚠️ Unrecognized button: "${buttonText}"`);
      return res.status(200).json({ status: "Unrecognized button command" });
    }

    // Trigger Heroku with wa_id as env var
    const herokuResponse = await triggerHerokuCommand(HEROKU_APP_NAME, wa_id);

    console.log("✅ Heroku dyno started", herokuResponse);

    return res.status(200).json({
      status: `Command triggered for ${HEROKU_APP_NAME}`,
      user: wa_id,
    });
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Trigger Heroku dyno and pass WA_ID
async function triggerHerokuCommand(HEROKU_APP_NAME, wa_id) {
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  if (!HEROKU_API_KEY) throw new Error("Heroku API key not configured");

  const response = await fetch(
    `https://api.heroku.com/apps/${HEROKU_APP_NAME}/dynos`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.heroku+json; version=3",
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: `WA_ID=${wa_id} node src/index.js`, // ✅ Pass user number
        attach: false,
        type: "worker",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Heroku API ${response.status}: ${errorText}`);
  }
  return response.json();
}
