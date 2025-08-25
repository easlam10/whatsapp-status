import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// === HELPER FUNCTIONS ===

// UTC+5 date helper
const getCurrentUTCPLUS5Date = () => {
  const now = new Date();
  const utcPlus5Date = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return utcPlus5Date.toISOString().split("T")[0];
};

export const extractCategoryCounts = (aiResult) => {
  const { categories, meta } = aiResult;
  return {
    executionNumber: meta.executionNumber,
    date: meta.date,
    total: meta.total,
    hrCount: categories.HR.length,
    marketingCount: categories.Marketing.length,
    pnmCount: categories.PNM.length,
    auditCount: categories.Audit.length,
    accountsCount: categories.Accounts.length,
    dcrCount: categories.DCR,
    othersCount: categories.Others.length,
  };
};

export const generateCategoryBreakdownMessage = async (aiResult) => {
  const { categories, meta } = aiResult;

  const formatEmails = async (emails) => {
    if (!emails || emails.length === 0) return "None";
    return emails.map((email, index) => `${index + 1}. ${email.replace(/;/g, ",")}`).join("\r");
  };

  return {
    executionNumber: meta.executionNumber,
    date: meta.date,
    HR: await formatEmails(categories.HR),
    Marketing: await formatEmails(categories.Marketing),
    PNM: await formatEmails(categories.PNM),
    Audit: await formatEmails(categories.Audit),
    Accounts: await formatEmails(categories.Accounts),
    DCR: `${categories.DCR} emails`,
    Others: await formatEmails(categories.Others),
  };
};

// === SEND FUNCTIONS (UPDATED to one number) ===

export async function sendWhatsAppCategorySummary(aiResult, recipientNumber) {
  if (!recipientNumber) {
    console.error("❌ No recipient number provided");
    return;
  }

  const url = `https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const counts = extractCategoryCounts(aiResult);

  const payload = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    type: "template",
    template: {
      name: "email_updates_1",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: counts.executionNumber.toString() },
            { type: "text", text: counts.date },
            { type: "text", text: counts.total.toString() },
            { type: "text", text: counts.hrCount.toString() },
            { type: "text", text: counts.marketingCount.toString() },
            { type: "text", text: counts.pnmCount.toString() },
            { type: "text", text: counts.auditCount.toString() },
            { type: "text", text: counts.accountsCount.toString() },
            { type: "text", text: counts.dcrCount.toString() },
            { type: "text", text: counts.othersCount.toString() },
          ],
        },
      ],
    },
  };

  try {
    console.log(`📤 Sending summary to ${recipientNumber}`);
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ Summary sent to ${recipientNumber}`, response.data);
  } catch (error) {
    console.error(`❌ Error sending summary to ${recipientNumber}:`, error.response?.data || error.message);
  }
}

export async function sendWhatsAppCategoryBreakdown(aiResult, recipientNumber) {
  if (!recipientNumber) {
    console.error("❌ No recipient number provided");
    return;
  }

  const url = `https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const breakdown = await generateCategoryBreakdownMessage(aiResult);

  const payload = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    type: "template",
    template: {
      name: "email_updates_2",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: breakdown.executionNumber?.toString() || "" },
            { type: "text", text: breakdown.date || "" },
            { type: "text", text: breakdown.HR || "None" },
            { type: "text", text: breakdown.Marketing || "None" },
            { type: "text", text: breakdown.PNM || "None" },
            { type: "text", text: breakdown.Audit || "None" },
            { type: "text", text: breakdown.Accounts || "None" },
            { type: "text", text: breakdown.DCR || "None" },
            { type: "text", text: breakdown.Others || "None" },
          ],
        },
      ],
    },
  };

  try {
    console.log(`📤 Sending breakdown to ${recipientNumber}`);
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ Breakdown sent to ${recipientNumber}`, response.data);
  } catch (error) {
    console.error(`❌ Error sending breakdown to ${recipientNumber}:`, error.response?.data || error.message);
  }
}
