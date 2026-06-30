// jobs/scheduler.js
const cron = require('node-cron');
const { Op } = require('sequelize');
const { WeeklyTarget, Machine, Shop, Ticket, Expense, User, Role, Setting, TokenInventory } = require('../models');
const { sendSMS, TEMPLATES } = require('../services/sms.service');

const getOpsManagerPhones = async () => {
  const ops = await User.findAll({
    include: [{ model: Role, as: 'role', where: { name: 'Operations Manager' } }],
    where: { is_active: true },
  });
  return ops.map(u => u.phone).filter(Boolean);
};

const getFinancePhones = async () => {
  const finance = await User.findAll({
    include: [{ model: Role, as: 'role', where: { name: 'Finance' } }],
    where: { is_active: true },
  });
  return finance.map(u => u.phone).filter(Boolean);
};

// Every Sunday at 23:00 — check weekly targets
cron.schedule('0 23 * * 0', async () => {
  console.log('[CRON] Checking weekly targets...');
  try {
    const targets = await WeeklyTarget.findAll({
      where: {
        week_end: { [Op.lte]: new Date().toISOString().split('T')[0] },
        status: 'pending',
      },
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
    });

    const phones = await getOpsManagerPhones();
    for (const t of targets) {
      const status = t.collected_tzs >= t.target_tzs ? 'met' : 'unmet';
      await t.update({ status });
      if (status === 'unmet' && phones.length > 0) {
        const msg = TEMPLATES.weeklyTargetUnmet(t.shop?.name, t.machine?.slot_code, t.collected_tzs, t.target_tzs);
        for (const phone of phones) await sendSMS(phone, msg);
      }
    }
    console.log(`[CRON] Processed ${targets.length} weekly targets`);
  } catch (err) {
    console.error('[CRON] Weekly target check failed:', err.message);
  }
});

// Every 30 minutes — check SLA breaches
cron.schedule('*/30 * * * *', async () => {
  try {
    const breached = await Ticket.findAll({
      where: {
        sla_deadline: { [Op.lt]: new Date() },
        status: { [Op.notIn]: ['resolved', 'closed'] },
      },
      limit: 50,
    });

    if (breached.length > 0) {
      const phones = await getOpsManagerPhones();
      for (const t of breached) {
        if (phones.length > 0) {
          const msg = TEMPLATES.ticketSLABreach(t.ticket_number, t.subject);
          for (const phone of phones) await sendSMS(phone, msg);
        }
      }
      console.log(`[CRON] ${breached.length} SLA breached tickets notified`);
    }
  } catch (err) {
    console.error('[CRON] SLA check failed:', err.message);
  }
});

// Daily at 08:00 — pending expenses reminder
cron.schedule('0 8 * * *', async () => {
  try {
    const count = await Expense.count({ where: { status: 'pending' } });
    if (count > 0) {
      const phones = await getFinancePhones();
      const msg = TEMPLATES.pendingExpenses(count);
      for (const phone of phones) await sendSMS(phone, msg);
      console.log(`[CRON] Sent pending expenses reminder: ${count} pending`);
    }
  } catch (err) {
    console.error('[CRON] Expense reminder failed:', err.message);
  }
});

// Daily at 09:00 — low token stock check
cron.schedule('0 9 * * *', async () => {
  try {
    const settingRow = await Setting.findOne({ where: { key: 'token_low_stock_threshold' } });
    const threshold = settingRow ? parseInt(settingRow.value) : 500;

    const totalResult = await TokenInventory.findAll({
      attributes: [
        [require('../config/database').fn('SUM', require('../config/database').col('qty')), 'total'],
      ],
    });
    const total = parseInt(totalResult[0]?.dataValues?.total || 0);

    if (total < threshold) {
      const phones = await getOpsManagerPhones();
      const msg = TEMPLATES.lowTokenStock(total);
      for (const phone of phones) await sendSMS(phone, msg);
      console.log(`[CRON] Low token stock alert sent: ${total} tokens`);
    }
  } catch (err) {
    console.error('[CRON] Token stock check failed:', err.message);
  }
});

console.log('[CRON] All scheduled jobs registered');
