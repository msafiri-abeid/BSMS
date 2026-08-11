// scripts/backfill-transfer-links.js
// One-time idempotent script: links legacy transfer legs (AccountTransaction rows with
// reference_type='transfer' and no transfer_id) to their AccountTransfer record so that
// transfer cancellation / detail view works for pre-existing transfers.
// Run: node scripts/backfill-transfer-links.js
const { Op } = require('sequelize');
const { Account, AccountTransaction, AccountTransfer } = require('../models');

async function backfill() {
  console.log('[BACKFILL] Linking legacy transfer legs to AccountTransfer records...');

  const transfers = await AccountTransfer.findAll();
  console.log(`[BACKFILL] Found ${transfers.length} AccountTransfer records`);

  let linked = 0;
  let ambiguous = 0;

  for (const transfer of transfers) {
    // The two legs were created with reference_type='transfer', reference_id NULL,
    // amount = transfer.amount, recorded_by = transfer.recorded_by
    const legs = await AccountTransaction.findAll({
      where: { reference_type: 'transfer', reference_id: null, transfer_id: null, amount: transfer.amount, recorded_by: transfer.recorded_by },
    });

    const outLeg = legs.find(l => l.account_id === transfer.from_account_id && l.type === 'out');
    const inLeg = legs.find(l => l.account_id === transfer.to_account_id && l.type === 'in');

    if (outLeg && inLeg) {
      const outId = outLeg.id;
      const inId = inLeg.id;
      if (outLeg.transfer_id || inLeg.transfer_id) continue; // already linked
      await AccountTransaction.update({ transfer_id: transfer.id, reference_id: transfer.id }, { where: { id: { [Op.in]: [outId, inId] } } });
      linked += 2;
    } else {
      ambiguous++;
      console.warn(`[BACKFILL] Skipping transfer #${transfer.id}: could not match both legs (out: ${!!outLeg}, in: ${!!inLeg})`);
    }
  }

  console.log(`[BACKFILL] Linked ${linked} transaction legs. Skipped (ambiguous): ${ambiguous}`);
  console.log('[BACKFILL] Done!');
  process.exit(0);
}

backfill().catch(err => {
  console.error('[BACKFILL] Error:', err);
  process.exit(1);
});
