// backend/controllers/kitchenStock.controller.js
const kitchenService = require('../services/kitchenStock.service');
const { KitchenDailyEntry } = require('../models');

// A Stock Manager may only edit/delete stock entries they created.
// Admin / General Manager / Operations Manager / Finance / Sales bypass the ownership check.
const canManageAny = (req) =>
  ['Admin', 'General Manager', 'Operations Manager', 'Finance', 'Sales'].includes(req.user.role?.name);

const canManageEntry = (req, entry) => {
  if (canManageAny(req)) return true;
  if (req.user.role?.name === 'Stock Manager') return Number(entry.created_by) === Number(req.user.id);
  return false;
};

// ─── LOCATIONS ────────────────────────────────────────────────
const listLocations = async (req, res, next) => {
  try {
    const data = await kitchenService.listLocations(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createLocation = async (req, res, next) => {
  try {
    const loc = await kitchenService.createLocation(req.body, req.user.id);
    res.status(201).json({ success: true, data: loc });
  } catch (err) { next(err); }
};

const updateLocation = async (req, res, next) => {
  try {
    const loc = await kitchenService.updateLocation(req.params.id, req.body);
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found' });
    res.json({ success: true, data: loc });
  } catch (err) { next(err); }
};

const deleteLocation = async (req, res, next) => {
  try {
    const loc = await kitchenService.deleteLocation(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found' });
    res.json({ success: true, data: loc });
  } catch (err) { next(err); }
};

// ─── ITEM CATALOG ─────────────────────────────────────────────
const listItems = async (req, res, next) => {
  try {
    const data = await kitchenService.listItems(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createItem = async (req, res, next) => {
  try {
    const item = await kitchenService.createItem(req.body, req.user.id);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await kitchenService.updateItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

const deleteItem = async (req, res, next) => {
  try {
    const item = await kitchenService.deleteItem(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

// ─── DAILY ENTRIES ────────────────────────────────────────────
const listEntries = async (req, res, next) => {
  try {
    const data = await kitchenService.listEntries(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const upsertEntries = async (req, res, next) => {
  try {
    const results = await kitchenService.upsertEntries(req.body, req.user.id);
    res.status(201).json({ success: true, data: results });
  } catch (err) { next(err); }
};

const updateEntry = async (req, res, next) => {
  try {
    const entry = await KitchenDailyEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (!canManageEntry(req, entry)) {
      return res.status(403).json({ success: false, message: 'You can only edit entries you created' });
    }
    const updated = await kitchenService.updateEntry(req.params.id, req.body, req.user.id);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

const deleteEntry = async (req, res, next) => {
  try {
    const entry = await KitchenDailyEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (!canManageEntry(req, entry)) {
      return res.status(403).json({ success: false, message: 'You can only delete entries you created' });
    }
    await kitchenService.deleteEntry(req.params.id);
    res.json({ success: true, data: { id: +req.params.id } });
  } catch (err) { next(err); }
};

const quickAdjust = async (req, res, next) => {
  try {
    const data = await kitchenService.quickAdjust(req.body, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── REPORTS ──────────────────────────────────────────────────
const getRestockList = async (req, res, next) => {
  try {
    const data = await kitchenService.getRestockList(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const data = await kitchenService.getStats(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const exportEntries = async (req, res, next) => {
  try {
    const buffer = await kitchenService.exportEntriesExcel(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kitchen-stock-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
};

const exportRestockPdf = async (req, res, next) => {
  try {
    const buffer = await kitchenService.exportRestockPdf(req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=restock-list-${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  listEntries,
  upsertEntries,
  updateEntry,
  deleteEntry,
  quickAdjust,
  getRestockList,
  getStats,
  exportEntries,
  exportRestockPdf,
};