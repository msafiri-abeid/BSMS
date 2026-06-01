// services/sms.service.js
const axios = require('axios');
const { BEEM_AFRICA } = require('../config/constants');
const { SmsLog } = require('../models');

const sendSMS = async (to, message) => {
  const logEntry = await SmsLog.create({ to, message, status: 'pending' });
  try {
    const response = await axios.post(
      `${BEEM_AFRICA.BASE_URL}/send`,
      {
        source_addr: BEEM_AFRICA.SENDER_NAME,
        schedule_time: '',
        encoding: 0,
        message,
        recipients: [{ recipient_id: '1', dest_addr: to }],
      },
      {
        auth: { username: BEEM_AFRICA.API_KEY, password: BEEM_AFRICA.SECRET },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await logEntry.update({ status: 'sent', response: JSON.stringify(response.data), sent_at: new Date() });
    return { success: true, data: response.data };
  } catch (err) {
    await logEntry.update({ status: 'failed', response: err.message });
    console.error('SMS send error:', err.message);
    return { success: false, error: err.message };
  }
};

const TEMPLATES = {
  weeklyTargetUnmet: (shopName, machineCode, collected, target) =>
    `BENTABET ALERT: Machine ${machineCode} at ${shopName} did not meet weekly target. Collected: ${collected.toLocaleString()} TZS / Target: ${target.toLocaleString()} TZS`,

  lowTokenStock: (currentQty) =>
    `BENTABET ALERT: Token stock is low. Current quantity: ${currentQty} tokens. Please arrange a purchase.`,

  ticketSLABreach: (ticketNo, subject) =>
    `BENTABET: Ticket #${ticketNo} SLA BREACHED. Subject: ${subject}. Please escalate immediately.`,

  pendingExpenses: (count) =>
    `BENTABET: You have ${count} expense(s) pending approval. Please review at your earliest convenience.`,

  machineNotOpened: (machineCode, days) =>
    `BENTABET ALERT: Machine ${machineCode} has not been opened for ${days} days. Please investigate.`,
};

module.exports = { sendSMS, TEMPLATES };
