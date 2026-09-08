// backend/services/kitchenStock.service.js
const { Location, KitchenItem, KitchenDailyEntry, User } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

// ─── HELPERS ─────────────────────────────────────────────────
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(num(v) * 100) / 100;

const ENTRY_INCLUDES = () => [
  { model: Location, as: 'location', attributes: ['id', 'name', 'code'] },
  { model: KitchenItem, as: 'item', attributes: ['id', 'name', 'category', 'default_unit', 'min_threshold'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
  { model: User, as: 'updater', attributes: ['id', 'name'] },
];

const toDecimal = (v) => (v === null || v === undefined ? null : round2(v));

const serializeEntry = (entry) => {
  const e = entry.get ? entry.get({ plain: true }) : entry;
  return {
    ...e,
    id: e.id,
    opening_stock: num(e.opening_stock),
    received: num(e.received),
    sold: num(e.sold),
    spoiled: num(e.spoiled),
    closing_stock: num(e.closing_stock),
    physical_count: e.physical_count === null || e.physical_count === undefined ? null : num(e.physical_count),
    variance: e.variance === null || e.variance === undefined ? null : num(e.variance),
  };
};

// Returns serializable plain-row for a stock item merged with its most recent entry's closing stock
const getCurrentStock = async (locationId, itemId) => {
  const latest = await KitchenDailyEntry.findOne({
    where: { location_id: locationId, item_id: itemId },
    order: [['entry_date', 'DESC']],
  });
  return latest ? num(latest.closing_stock) : 0;
};

// ─── LOCATIONS ────────────────────────────────────────────────
const listLocations = async (filters = {}) => {
  const where = {};
  if (filters.is_active !== undefined) where.is_active = filters.is_active === 'true' || filters.is_active === true;
  const rows = await Location.findAll({
    where,
    order: [[filters.sort || 'name', 'ASC']],
  });
  const total = await Location.count({ where });
  return { data: rows, count: total };
};

const createLocation = async (data, userId) => {
  if (!data.name || !data.code) throw new Error('name and code are required');
  const [loc, created] = await Location.findOrCreate({
    where: { name: data.name },
    defaults: { name: data.name, code: data.code.toUpperCase(), is_active: data.is_active !== false },
  });
  if (!created && loc.code !== (data.code || '').toUpperCase()) {
    await loc.update({ code: data.code.toUpperCase() });
  }
  return loc;
};

const updateLocation = async (id, data) => {
  const loc = await Location.findByPk(id);
  if (!loc) return null;
  await loc.update({
    name: data.name ?? loc.name,
    code: data.code ? data.code.toUpperCase() : loc.code,
    is_active: data.is_active !== undefined ? !!data.is_active : loc.is_active,
  });
  return loc;
};

const deleteLocation = async (id) => {
  const loc = await Location.findByPk(id);
  if (!loc) return null;
  // Soft-deactivate only — historical entries stay intact.
  await loc.update({ is_active: false });
  return loc;
};

// ─── ITEM CATALOG ─────────────────────────────────────────────
const listItems = async (filters = {}) => {
  const where = { is_active: true };
  if (filters.category) where.category = filters.category;
  if (filters.search) where.name = { [Op.like]: `%${filters.search}%` };

  const rows = await KitchenItem.findAll({
    where,
    order: [[filters.sort || 'name', 'ASC']],
    limit: +(filters.limit || 500),
    offset: +(filters.offset || 0),
  });
  const count = await KitchenItem.count({ where });
  return { data: rows, count };
};

const createItem = async (data, userId) => {
  if (!data.name) throw new Error('name is required');
  const [item, created] = await KitchenItem.findOrCreate({
    where: { name: data.name },
    defaults: {
      name: data.name,
      category: data.category || 'other',
      default_unit: data.default_unit || 'qty',
      min_threshold: num(data.min_threshold),
      is_active: true,
    },
  });
  return item;
};

const updateItem = async (id, data) => {
  const item = await KitchenItem.findByPk(id);
  if (!item) return null;
  await item.update({
    name: data.name ?? item.name,
    category: data.category ?? item.category,
    default_unit: data.default_unit ?? item.default_unit,
    min_threshold: data.min_threshold !== undefined ? num(data.min_threshold) : item.min_threshold,
    is_active: data.is_active !== undefined ? !!data.is_active : item.is_active,
  });
  return item;
};

// ─── DAILY ENTRIES ────────────────────────────────────────────
// Returns the day's entries for a location, auto-carrying opening stock from
// the previous day's closing for items that have no entry yet.
const listEntries = async (filters = {}) => {
  const locationId = +filters.location_id;
  const entryDate = filters.date || new Date().toISOString().split('T')[0];
  if (!locationId) throw new Error('location_id is required');

  const dateObj = new Date(entryDate);
  const prevDate = new Date(dateObj);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const [entries, prevEntries, items] = await Promise.all([
    KitchenDailyEntry.findAll({
      where: { location_id: locationId, entry_date: entryDate },
      include: ENTRY_INCLUDES(),
      order: [[{ model: KitchenItem, as: 'item' }, 'name', 'ASC']],
    }),
    KitchenDailyEntry.findAll({
      where: { location_id: locationId, entry_date: { [Op.lte]: prevDateStr } },
      attributes: ['item_id', 'entry_date', 'closing_stock'],
      order: [['entry_date', 'DESC']],
    }),
    KitchenItem.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
  ]);

  // Map item_id -> most recent closing before the target date
  const prevClosingByItem = {};
  for (const p of prevEntries) {
    if (prevClosingByItem[p.item_id] === undefined) {
      prevClosingByItem[p.item_id] = num(p.closing_stock);
    }
  }

  const byItem = new Map(entries.map((e) => [e.get ? e.item_id : e.item_id, e]));

  // Merge catalog items (potential "no entry yet" rows) with existing entries.
  const merged = items.map((it) => {
    const entry = byItem.get(it.id);
    if (!entry) {
      return {
        id: null,
        location_id: locationId,
        item_id: it.id,
        entry_date: entryDate,
        opening_stock: prevClosingByItem[it.id] ?? 0,
        received: 0,
        sold: 0,
        spoiled: 0,
        closing_stock: prevClosingByItem[it.id] ?? 0,
        physical_count: null,
        variance: null,
        notes: null,
        location: null,
        item: { id: it.id, name: it.name, category: it.category, default_unit: it.default_unit, min_threshold: num(it.min_threshold) },
      };
    }
    return serializeEntry(entry);
  });

  return { data: merged, count: merged.length, date: entryDate, prev_date: prevDateStr };
};

// Bulk upsert day entries. Business rules:
//   closing_stock = opening_stock + received - sold - spoiled
//   variance      = physical_count - closing_stock (only when physical_count given)
const upsertEntries = async (body, userId) => {
  const locationId = +body.location_id;
  const entryDate = body.entry_date || new Date().toISOString().split('T')[0];
  if (!locationId) throw new Error('location_id is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('items array is required');
  }

  const dateObj = new Date(entryDate);
  const prevDate = new Date(dateObj);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const results = [];
  for (const raw of body.items) {
    const itemId = +raw.item_id;
    if (!itemId) throw new Error('item_id is required for each item');

    // Resolve opening stock from previous day's closing stock.
    const prev = await KitchenDailyEntry.findOne({
      where: { location_id: locationId, item_id: itemId, entry_date: { [Op.lte]: prevDateStr } },
      order: [['entry_date', 'DESC']],
    });
    const opening = num(raw.opening_stock ?? prev?.closing_stock ?? 0);
    const received = num(raw.received ?? 0);
    const sold = num(raw.sold ?? 0);
    const spoiled = num(raw.spoiled ?? 0);
    const closing = round2(opening + received - sold - spoiled);
    const physical = raw.physical_count === null || raw.physical_count === undefined || raw.physical_count === ''
      ? null
      : num(raw.physical_count);
    const variance = physical === null ? null : round2(physical - closing);

    const [entry, created] = await KitchenDailyEntry.findOrCreate({
      where: { location_id: locationId, item_id: itemId, entry_date: entryDate },
      defaults: {
        opening_stock: opening,
        received,
        sold,
        spoiled,
        closing_stock: closing,
        physical_count: physical,
        variance,
        notes: raw.notes || null,
        created_by: userId,
      },
    });

    if (!created) {
      await entry.update({
        opening_stock: opening,
        received,
        sold,
        spoiled,
        closing_stock: closing,
        physical_count: physical,
        variance,
        notes: raw.notes !== undefined ? raw.notes || null : entry.notes,
        updated_by: userId,
      });
      await entry.reload({ include: ENTRY_INCLUDES() });
    } else {
      await entry.reload({ include: ENTRY_INCLUDES() });
    }

    results.push({ created, entry: serializeEntry(entry) });
  }

  return results;
};

const updateEntry = async (id, body, userId) => {
  const entry = await KitchenDailyEntry.findByPk(id, { include: ENTRY_INCLUDES() });
  if (!entry) return null;

  const received = body.received !== undefined ? num(body.received) : num(entry.received);
  const sold = body.sold !== undefined ? num(body.sold) : num(entry.sold);
  const spoiled = body.spoiled !== undefined ? num(body.spoiled) : num(entry.spoiled);
  const opening = body.opening_stock !== undefined ? num(body.opening_stock) : num(entry.opening_stock);
  const closing = round2(opening + received - sold - spoiled);
  const physical = body.physical_count === null || body.physical_count === undefined || body.physical_count === ''
    ? (entry.physical_count === null || entry.physical_count === undefined ? null : num(entry.physical_count))
    : num(body.physical_count);
  const variance = physical === null ? null : round2(physical - closing);

  await entry.update({
    opening_stock: opening,
    received,
    sold,
    spoiled,
    closing_stock: closing,
    physical_count: physical,
    variance,
    notes: body.notes !== undefined ? body.notes || null : entry.notes,
    updated_by: userId,
  });
  return serializeEntry(entry);
};

// Quick +/- adjust: + adds to received, - adds to sold (consumption).
// Pre-fills today's entry with opening carried from previous closing when needed.
const quickAdjust = async (body, userId) => {
  const locationId = +body.location_id;
  const itemId = +body.item_id;
  const adjustment = num(body.adjustment);
  if (!locationId || !itemId) throw new Error('location_id and item_id are required');
  if (adjustment === 0) throw new Error('adjustment cannot be 0');
  const type = body.type === 'spoiled' ? 'spoiled' : body.type === 'received' ? 'received' : 'sold';
  const entryDate = body.entry_date || new Date().toISOString().split('T')[0];

  const dateObj = new Date(entryDate);
  const prevDate = new Date(dateObj);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const prev = await KitchenDailyEntry.findOne({
    where: { location_id: locationId, item_id: itemId, entry_date: { [Op.lte]: prevDateStr } },
    order: [['entry_date', 'DESC']],
  });

  const existing = await KitchenDailyEntry.findOne({
    where: { location_id: locationId, item_id: itemId, entry_date: entryDate },
    include: ENTRY_INCLUDES(),
  });

  let entry;
  if (existing) {
    const patch = {};
    patch[type] = round2(num(existing[type]) + adjustment);
    const received = type === 'received' ? patch.received : num(existing.received);
    const sold = type === 'sold' ? patch.sold : num(existing.sold);
    const spoiled = type === 'spoiled' ? patch.spoiled : num(existing.spoiled);
    const opening = num(existing.opening_stock);
    const closing = round2(opening + received - sold - spoiled);
    const physical = existing.physical_count === null || existing.physical_count === undefined
      ? null
      : num(existing.physical_count);
    const variance = physical === null ? null : round2(physical - closing);
    await existing.update({
      ...patch,
      closing_stock: closing,
      variance,
      updated_by: userId,
    });
    await existing.reload({ include: ENTRY_INCLUDES() });
    entry = existing;
  } else {
    const opening = num(prev?.closing_stock ?? 0);
    const received = type === 'received' ? round2(adjustment) : 0;
    const sold = type === 'sold' ? round2(adjustment) : 0;
    const spoiled = type === 'spoiled' ? round2(adjustment) : 0;
    const closing = round2(opening + received - sold - spoiled);
    entry = await KitchenDailyEntry.create({
      location_id: locationId,
      item_id: itemId,
      entry_date: entryDate,
      opening_stock: opening,
      received,
      sold,
      spoiled,
      closing_stock: closing,
      physical_count: null,
      variance: null,
      created_by: userId,
    });
    await entry.reload({ include: ENTRY_INCLUDES() });
  }

  return { ...serializeEntry(entry), qty_change: round2(adjustment), type };
};

// ─── REPORTS ──────────────────────────────────────────────────
// Items at or below their threshold, using latest closing stock per item.
const getRestockList = async (filters = {}) => {
  const locationId = filters.location_id ? +filters.location_id : null;
  const entryDate = filters.date || new Date().toISOString().split('T')[0];

  const where = { location_id: locationId, entry_date: { [Op.lte]: entryDate } };
  const all = await KitchenDailyEntry.findAll({
    where,
    include: [
      { model: KitchenItem, as: 'item', attributes: ['id', 'name', 'category', 'default_unit', 'min_threshold'], where: { is_active: true } },
    ],
    order: [['entry_date', 'DESC']],
  });

  // Latest entry per item
  const latestByItem = new Map();
  for (const e of all) {
    if (!latestByItem.has(e.item_id)) latestByItem.set(e.item_id, e);
  }

  const rows = [];
  for (const e of latestByItem.values()) {
    const closing = num(e.closing_stock);
    const threshold = num(e.item.min_threshold);
    if (threshold > 0 && closing <= threshold) {
      rows.push({
        ...serializeEntry(e),
        is_low: true,
        stock_ratio: threshold > 0 ? round2(closing / threshold) : 0,
        item: { id: e.item.id, name: e.item.name, category: e.item.category, default_unit: e.item.default_unit, min_threshold: threshold },
      });
    }
  }

  rows.sort((a, b) => a.stock_ratio - b.stock_ratio);
  return { data: rows, count: rows.length, date: entryDate };
};

const getStats = async (filters = {}) => {
  const locationId = filters.location_id ? +filters.location_id : null;
  const entryDate = filters.date || new Date().toISOString().split('T')[0];

  const where = { entry_date: { [Op.lte]: entryDate } };
  if (locationId) where.location_id = locationId;

  const all = await KitchenDailyEntry.findAll({
    where,
    include: [{ model: KitchenItem, as: 'item', attributes: ['id', 'name', 'min_threshold'], where: { is_active: true } }],
    order: [['entry_date', 'DESC']],
  });

  const latestByItem = new Map();
  for (const e of all) {
    if (!latestByItem.has(e.item_id)) latestByItem.set(e.item_id, e);
  }

  let totalItems = latestByItem.size;
  let lowStock = 0;
  let outOfStock = 0;
  for (const e of latestByItem.values()) {
    const closing = num(e.closing_stock);
    const threshold = num(e.item.min_threshold);
    if (threshold > 0 && closing <= threshold) lowStock++;
    if (closing <= 0) outOfStock++;
  }

  const todayCount = await KitchenDailyEntry.count({
    where: locationId ? { location_id: locationId, entry_date: entryDate } : { entry_date: entryDate },
  });

  const activeLocationCount = await Location.count({ where: { is_active: true } });

  return { totalItems, lowStock, outOfStock, todayCount, activeLocationCount, date: entryDate };
};

// ─── STOCK MANAGER DASHBOARD ──────────────────────────────────
// Aggregates kitchen data across all active locations for the Stock Manager dashboard.
const getStockManagerDashboard = async (filters = {}) => {
  const today = new Date().toISOString().split('T')[0];

  const [locations, items] = await Promise.all([
    Location.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    KitchenItem.findAll({ where: { is_active: true }, attributes: ['id', 'name', 'category', 'default_unit', 'min_threshold'] }),
  ]);

  // Today's entries per location, summed.
  const todaysEntries = await KitchenDailyEntry.findAll({
    where: { entry_date: today },
    attributes: ['location_id', 'received', 'sold', 'spoiled', 'closing_stock'],
    raw: true,
  });

  // Per-location low-stock count from the latest closing stock per item.
  const latestRows = await KitchenDailyEntry.findAll({
    where: { entry_date: { [Op.lte]: today } },
    attributes: ['location_id', 'item_id', 'entry_date', 'closing_stock'],
    order: [['entry_date', 'DESC']],
    raw: true,
  });
  const latestByLocationItem = {};
  for (const r of latestRows) {
    const key = `${r.location_id}:${r.item_id}`;
    if (latestByLocationItem[key] === undefined) latestByLocationItem[key] = r;
  }

  const thresholdByItem = new Map(items.map((i) => [i.id, num(i.min_threshold)]));

  const perLocation = locations.map((loc) => {
    const sums = todaysEntries
      .filter((e) => Number(e.location_id) === Number(loc.id))
      .reduce(
        (acc, e) => ({
          received: acc.received + num(e.received),
          sold: acc.sold + num(e.sold),
          spoiled: acc.spoiled + num(e.spoiled),
          closing: acc.closing + num(e.closing_stock),
        }),
        { received: 0, sold: 0, spoiled: 0, closing: 0 },
      );

    let lowStockCount = 0;
    let outOfStockCount = 0;
    items.forEach((item) => {
      const latest = latestByLocationItem[`${loc.id}:${item.id}`];
      if (!latest) return;
      const closing = num(latest.closing_stock);
      const threshold = thresholdByItem.get(item.id) || 0;
      if (threshold > 0 && closing <= threshold) lowStockCount++;
      if (closing <= 0) outOfStockCount++;
    });

    return {
      location_id: loc.id,
      name: loc.name,
      code: loc.code,
      received: round2(sums.received),
      sold: round2(sums.sold),
      spoiled: round2(sums.spoiled),
      closing: round2(sums.closing),
      lowStockCount,
      outOfStockCount,
    };
  });

  // Global low / out-of-stock: an item is flagged when ANY location needs restock.
  let lowStockItems = 0;
  let outOfStockItems = 0;
  items.forEach((item) => {
    let latestClosing = null;
    for (const loc of locations) {
      const latest = latestByLocationItem[`${loc.id}:${item.id}`];
      if (!latest) continue;
      const c = num(latest.closing_stock);
      latestClosing = latestClosing === null ? c : Math.min(latestClosing, c);
    }
    const threshold = thresholdByItem.get(item.id) || 0;
    if (latestClosing === null) return;
    if (threshold > 0 && latestClosing <= threshold) lowStockItems++;
    if (latestClosing <= 0) outOfStockItems++;
  });

  const todayCount = await KitchenDailyEntry.count({ where: { entry_date: today } });

  // Restock list per location (items at/below threshold).
  const restock = [];
  for (const loc of locations) {
    const locRestock = await getRestockList({ location_id: loc.id, date: today });
    for (const row of locRestock.data) {
      restock.push({
        item: row.item,
        location: { id: loc.id, name: loc.name, code: loc.code },
        closing_stock: row.closing_stock,
        stock_ratio: row.stock_ratio,
      });
    }
  }
  restock.sort((a, b) => a.stock_ratio - b.stock_ratio);

  return {
    overview: {
      totalItems: items.length,
      activeLocations: locations.length,
      lowStockItems,
      outOfStockItems,
      todayRecordedCount: todayCount,
    },
    perLocation,
    restock,
    date: today,
  };
};

// Excel export mirroring the DANTE26 DAILY KITCHEN STOCK sheet layout.
const exportEntriesExcel = async (filters = {}) => {
  const locationId = +filters.location_id;
  if (!locationId) throw new Error('location_id is required');
  const from = filters.date_from || new Date().toISOString().split('T')[0];
  const to = filters.date_to || from;

  const location = await Location.findByPk(locationId);
  if (!location) throw new Error('Location not found');

  const entries = await KitchenDailyEntry.findAll({
    where: { location_id: locationId, entry_date: { [Op.between]: [from, to] } },
    include: [
      { model: KitchenItem, as: 'item', attributes: ['id', 'name', 'default_unit'] },
      { model: User, as: 'creator', attributes: ['id', 'name'] },
    ],
    order: [['entry_date', 'ASC'], [{ model: KitchenItem, as: 'item' }, 'name', 'ASC']],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Kitchen Stock ${location.code || location.name}`);

  ws.columns = [
    { header: 'NO', key: 'no', width: 6 },
    { header: 'DETAILS', key: 'details', width: 28 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Opening Stock', key: 'opening', width: 14 },
    { header: 'Received', key: 'received', width: 12 },
    { header: 'Total Sold', key: 'sold', width: 12 },
    { header: 'Spoiled / Damaged', key: 'spoiled', width: 18 },
    { header: 'Closing Stock', key: 'closing', width: 14 },
    { header: 'Physical Count', key: 'physical', width: 14 },
    { header: 'Variance / Shortage', key: 'variance', width: 18 },
    { header: 'Notes', key: 'notes', width: 24 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: 'A1', to: 'L1' };

  let idx = 1;
  for (const e of entries) {
    idx++;
    const variance = e.variance === null || e.variance === undefined ? '' : num(e.variance);
    ws.addRow({
      no: idx - 1,
      details: e.item?.name || `#${e.item_id}`,
      unit: e.item?.default_unit || '',
      date: e.entry_date,
      opening: num(e.opening_stock),
      received: num(e.received),
      sold: num(e.sold),
      spoiled: num(e.spoiled),
      closing: num(e.closing_stock),
      physical: e.physical_count === null || e.physical_count === undefined ? '' : num(e.physical_count),
      variance,
      notes: e.notes || '',
    });
    // Highlight negative variance (shortage) in red
    if (num(variance) < 0) {
      ws.getRow(idx).getCell('K').font = { bold: true, color: { argb: 'FFC0392B' } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  listItems,
  createItem,
  updateItem,
  listEntries,
  upsertEntries,
  updateEntry,
  quickAdjust,
  getRestockList,
  getStats,
  getStockManagerDashboard,
  exportEntriesExcel,
};