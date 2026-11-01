// backend/services/kitchenStock.service.js
const { Location, KitchenItem, KitchenDailyEntry, KitchenStockMovement, User } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

// ─── HELPERS ─────────────────────────────────────────────────
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(num(v) * 100) / 100;

const MOVEMENT_LABELS = { received: 'Received', sold: 'Sold', spoiled: 'Spoiled' };

// Day-level notes are stored as a JSON array of strings (TEXT column).
const parseNotes = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((n) => n && String(n).trim()).map((n) => String(n).trim());
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const a = JSON.parse(t);
        if (Array.isArray(a)) return parseNotes(a);
      } catch { /* fall through to legacy string */ }
    }
    return [t];
  }
  return [];
};

const serializeNotes = (arr) => {
  const a = parseNotes(arr);
  return a.length ? JSON.stringify(a) : null;
};

const ENTRY_INCLUDES = () => [
  { model: Location, as: 'location', attributes: ['id', 'name', 'code'] },
  { model: KitchenItem, as: 'item', attributes: ['id', 'name', 'category', 'default_unit', 'min_threshold', 'is_active'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
  { model: User, as: 'updater', attributes: ['id', 'name'] },
  {
    model: KitchenStockMovement, as: 'movements',
    include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
    order: [['created_at', 'ASC']],
  },
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
    notes: parseNotes(e.notes),
    movements: Array.isArray(e.movements)
      ? e.movements.map((m) => ({
          id: m.id,
          type: m.type,
          quantity: num(m.quantity),
          notes: m.notes || null,
          created_at: m.created_at,
          recorded_by: m.creator ? m.creator.name || m.creator.id : null,
        }))
      : [],
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

const updateItem = async (id, data, userId) => {
  const item = await KitchenItem.findByPk(id);
  if (!item) return null;
  await item.update({
    name: data.name ?? item.name,
    category: data.category ?? item.category,
    default_unit: data.default_unit ?? item.default_unit,
    min_threshold: data.min_threshold !== undefined ? num(data.min_threshold) : item.min_threshold,
    is_active: data.is_active !== undefined ? !!data.is_active : item.is_active,
  });

  // Optional: persist a received-batch expiry on the day's entry for this item.
  // Used by the Stock Overview "Edit Item" action — one atomic save for item + batch expiry.
  if (data.location_id && data.entry_date && data.expiry_date !== undefined) {
    const locationId = +data.location_id;
    const entryDate = data.entry_date;
    const prev = await KitchenDailyEntry.findOne({
      where: { location_id: locationId, item_id: item.id, entry_date: { [Op.lte]: entryDate } },
      order: [['entry_date', 'DESC']],
    });
    const [entry] = await KitchenDailyEntry.findOrCreate({
      where: { location_id: locationId, item_id: item.id, entry_date: entryDate },
      defaults: {
        opening_stock: prev?.closing_stock ?? 0,
        received: 0,
        sold: 0,
        spoiled: 0,
        closing_stock: prev?.closing_stock ?? 0,
        notes: null,
        expiry_date: data.expiry_date || null,
        created_by: userId || null,
      },
    });
    await entry.update({
      expiry_date: data.expiry_date || null,
      updated_by: userId || entry.updated_by,
    });
  }

  return item;
};

const deleteItem = async (id) => {
  const item = await KitchenItem.findByPk(id);
  if (!item) return null;
  await item.update({ is_active: false });
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
      attributes: ['item_id', 'entry_date', 'closing_stock', 'expiry_date'],
      order: [['entry_date', 'DESC']],
    }),
    KitchenItem.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
  ]);

  // Map item_id -> most recent closing + lot expiry before the target date
  const prevClosingByItem = {};
  const prevExpiryByItem = {};
  for (const p of prevEntries) {
    if (prevClosingByItem[p.item_id] === undefined) {
      prevClosingByItem[p.item_id] = num(p.closing_stock);
      prevExpiryByItem[p.item_id] = p.expiry_date || null;
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
        notes: [],
        movements: [],
        expiry_date: prevExpiryByItem[it.id] ?? null,
        location: null,
        item: { id: it.id, name: it.name, category: it.category, default_unit: it.default_unit, min_threshold: num(it.min_threshold), is_active: it.is_active },
      };
    }
    return {
      ...serializeEntry(entry),
      expiry_date: entry.expiry_date || prevExpiryByItem[entry.item_id] || null,
    };
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
        notes: serializeNotes(raw.notes),
        expiry_date: raw.expiry_date || null,
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
        notes: raw.notes !== undefined ? serializeNotes(raw.notes) : entry.notes,
        expiry_date: raw.expiry_date !== undefined ? raw.expiry_date || null : entry.expiry_date,
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

const deleteEntry = async (id) => {
  const entry = await KitchenDailyEntry.findByPk(id);
  if (!entry) return null;
  await KitchenStockMovement.destroy({ where: { entry_id: id } });
  await entry.destroy();
  return true;
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
    notes: body.notes !== undefined ? serializeNotes(body.notes) : entry.notes,
    expiry_date: body.expiry_date !== undefined ? body.expiry_date || null : entry.expiry_date,
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
    if (body.expiry_date !== undefined) patch.expiry_date = body.expiry_date || null;
    await existing.update({ ...patch, closing_stock: closing, variance, updated_by: userId });
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
      expiry_date: type === 'received' ? (body.expiry_date || null) : null,
      created_by: userId,
    });
    await entry.reload({ include: ENTRY_INCLUDES() });
  }

  // Record a labeled movement so the day's item detail shows what happened.
  const qty = Math.abs(round2(adjustment));
  await KitchenStockMovement.create({
    location_id: locationId,
    item_id: itemId,
    entry_id: entry.id,
    entry_date: entryDate,
    type,
    quantity: qty,
    notes: body.notes ? String(body.notes).trim() || null : null,
    created_by: userId,
  });
  await entry.reload({ include: ENTRY_INCLUDES() });

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

// Restock list rendered as a PDF (matches the BENTABET report style).
const exportRestockPdf = async (filters = {}) => {
  const locationId = +filters.location_id;
  if (!locationId) throw new Error('location_id is required');

  const location = await Location.findByPk(locationId);
  if (!location) throw new Error('Location not found');

  const { data: rows, count, date } = await getRestockList(filters);

  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brandColor = '#021559';
    const lightGray = '#f1f5f9';
    const textColor = '#1e293b';
    const mutedColor = '#64748b';
    const borderColor = '#e2e8f0';

    doc.fontSize(18).fillColor(brandColor).font('Helvetica-Bold').text('BENTABET LTD', 45, 40);
    doc.fontSize(10).fillColor(mutedColor).font('Helvetica').text('Kitchen Restock List', 45, 65);
    doc.moveTo(45, 82).lineTo(545, 82).strokeColor(borderColor).lineWidth(1).stroke();

    let y = 100;
    const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    doc.fontSize(9).fillColor(mutedColor).text('Location:', 45, y);
    doc.fillColor(textColor).text(`${location.name} (${location.code})`, 100, y);
    doc.fillColor(mutedColor).text('Date:', 300, y);
    doc.fillColor(textColor).text(fmtDate(date), 335, y);

    y += 16;
    doc.fillColor(mutedColor).text('Generated:', 45, y);
    doc.fillColor(textColor).text(fmtDate(new Date().toISOString().split('T')[0]), 100, y);
    doc.fillColor(mutedColor).text('Items at/below threshold:', 300, y);
    doc.fillColor(textColor).text(String(count), 395, y);

    y = 145;
    doc.rect(45, y, 505, 22).fill(brandColor);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('#', 52, y + 7);
    doc.text('ITEM', 75, y + 7);
    doc.text('UNIT', 330, y + 7);
    doc.text('CURRENT', 385, y + 7, { width: 60, align: 'right' });
    doc.text('THRESHOLD', 445, y + 7, { width: 60, align: 'right' });

    y += 22;
    let idx = 0;
    for (const r of rows) {
      idx++;
      if (y > 700) {
        doc.addPage();
        y = 45;
      }
      if (idx % 2 === 0) {
        doc.rect(45, y, 505, 18).fill(lightGray);
      }
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text(String(idx), 52, y + 5);
      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text(r.item?.name || `#${r.item_id}`, 75, y + 5, { width: 250 });
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text(r.item?.default_unit || '', 330, y + 5);
      doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold').text(num(r.closing_stock), 385, y + 5, { width: 60, align: 'right' });
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(num(r.item?.min_threshold), 445, y + 5, { width: 60, align: 'right' });
      y += 18;
    }

    if (count === 0) {
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text('All items are above threshold — nothing to restock.', 75, y + 6);
    }

    doc.moveTo(45, y + 20).lineTo(545, y + 20).strokeColor(borderColor).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(mutedColor).font('Helvetica').text(
      `Generated by BENTABET Slot Management System — ${count} item(s) at or below minimum threshold.`,
      45, y + 28
    );

    doc.end();
  });
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
const getExportDateRange = (from, to) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const dates = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    dates.push(cur.toISOString().split('T')[0]);
  }
  return dates;
};

const exportEntriesExcel = async (filters = {}) => {
  const locationId = +filters.location_id;
  if (!locationId) throw new Error('location_id is required');

  const from = filters.date_from || new Date().toISOString().split('T')[0];
  const to = filters.date_to || from;

  const location = await Location.findByPk(locationId);
  if (!location) throw new Error('Location not found');

  const dates = getExportDateRange(from, to);
  const exportRows = [];

  for (const date of dates) {
    const { data: rows } = await listEntries({ location_id: locationId, date });
    for (const row of rows) {
      exportRows.push({
        id: row.id,
        item_id: row.item_id,
        item_name: row.item?.name || `#${row.item_id}`,
        unit: row.item?.default_unit || '',
        date,
        opening: num(row.opening_stock),
        received: num(row.received),
        sold: num(row.sold),
        spoiled: num(row.spoiled),
        closing: num(row.closing_stock),
        physical: row.physical_count === null || row.physical_count === undefined ? '' : num(row.physical_count),
        variance: row.variance === null || row.variance === undefined ? '' : num(row.variance),
        notes: parseNotes(row.notes).concat((row.movements || []).map((m) => m.notes ? `${MOVEMENT_LABELS[m.type] || m.type}: ${num(m.quantity)} (${m.notes})` : `${MOVEMENT_LABELS[m.type] || m.type}: ${num(m.quantity)}`)).join(' | '),
      });
    }
  }

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
  for (const row of exportRows) {
    idx++;
    ws.addRow({
      no: idx - 1,
      details: row.item_name,
      unit: row.unit,
      date: row.date,
      opening: row.opening,
      received: row.received,
      sold: row.sold,
      spoiled: row.spoiled,
      closing: row.closing,
      physical: row.physical,
      variance: row.variance,
      notes: row.notes,
    });

    if (Number(row.variance) < 0) {
      ws.getRow(idx).getCell('K').font = { bold: true, color: { argb: 'FFC0392B' } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

const exportEntriesPdf = async (filters = {}) => {
  const locationId = +filters.location_id;
  if (!locationId) throw new Error('location_id is required');

  const from = filters.date_from || filters.date || new Date().toISOString().split('T')[0];
  const to = filters.date_to || from;

  const location = await Location.findByPk(locationId);
  if (!location) throw new Error('Location not found');

  const dates = getExportDateRange(from, to);
  const rows = [];

  for (const date of dates) {
    const { data: dailyRows } = await listEntries({ location_id: locationId, date });
    rows.push(...dailyRows.map((row) => ({
      item_name: row.item?.name || `#${row.item_id}`,
      unit: row.item?.default_unit || '',
      date,
      opening: num(row.opening_stock),
      received: num(row.received),
      sold: num(row.sold),
      spoiled: num(row.spoiled),
      closing: num(row.closing_stock),
      variance: row.variance === null || row.variance === undefined ? '' : num(row.variance),
      notes: parseNotes(row.notes).concat((row.movements || []).map((m) => m.notes ? `${MOVEMENT_LABELS[m.type] || m.type}: ${num(m.quantity)} (${m.notes})` : `${MOVEMENT_LABELS[m.type] || m.type}: ${num(m.quantity)}`)).join(' | ') || '—',
    })));
  }

  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brandColor = '#021559';
    const muted = '#64748b';
    const border = '#e2e8f0';
    const lightGray = '#f8fafc';

    doc.fontSize(18).fillColor(brandColor).font('Helvetica-Bold').text('BENTABET LTD', 40, 40);
    doc.fontSize(10).fillColor(muted).font('Helvetica').text('Kitchen Stock Ledger', 40, 66);
    doc.moveTo(40, 82).lineTo(555, 82).strokeColor(border).lineWidth(1).stroke();

    let y = 96;
    doc.fontSize(9).fillColor(muted).text('Location:', 40, y);
    doc.fillColor('#0f172a').text(`${location.name} (${location.code})`, 95, y);
    doc.fillColor(muted).text('Date range:', 335, y);
    doc.fillColor('#0f172a').text(`${from} to ${to}`, 395, y);
    y += 18;
    doc.fillColor(muted).text('Items exported:', 40, y);
    doc.fillColor('#0f172a').text(String(rows.length), 110, y);

    y += 22;
    doc.rect(40, y, 515, 22).fill(brandColor);
    doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
    doc.text('ITEM', 48, y + 7, { width: 150 });
    doc.text('DATE', 200, y + 7, { width: 60 });
    doc.text('UNIT', 265, y + 7, { width: 45 });
    doc.text('OPEN', 315, y + 7, { width: 42, align: 'right' });
    doc.text('RECV', 360, y + 7, { width: 42, align: 'right' });
    doc.text('SOLD', 405, y + 7, { width: 42, align: 'right' });
    doc.text('SPOIL', 450, y + 7, { width: 42, align: 'right' });
    doc.text('CLOSING', 495, y + 7, { width: 40, align: 'right' });

    y += 22;
    rows.forEach((r, idx) => {
      if (y > 720) {
        doc.addPage();
        y = 45;
      }
      if (idx % 2 === 0) doc.rect(40, y, 515, 18).fill(lightGray);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(String(r.item_name || ''), 48, y + 5, { width: 145 });
      doc.text(String(r.date || ''), 200, y + 5, { width: 52 });
      doc.text(String(r.unit || ''), 265, y + 5, { width: 40 });
      doc.text(String(num(r.opening)), 315, y + 5, { width: 42, align: 'right' });
      doc.text(String(num(r.received)), 360, y + 5, { width: 42, align: 'right' });
      doc.text(String(num(r.sold)), 405, y + 5, { width: 42, align: 'right' });
      doc.text(String(num(r.spoiled)), 450, y + 5, { width: 42, align: 'right' });
      doc.text(String(num(r.closing)), 495, y + 5, { width: 40, align: 'right' });
      y += 18;
    });

    if (rows.length === 0) {
      doc.fillColor(muted).fontSize(9).font('Helvetica').text('No stock rows available for the selected date range.', 48, y + 12);
    }

    doc.end();
  });
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
  getStockManagerDashboard,
  exportEntriesExcel,
  exportEntriesPdf,
  exportRestockPdf,
};