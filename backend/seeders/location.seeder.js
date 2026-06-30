const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Region, District, Ward, Street } = require('../models');

function parseCSV(text) {
  const rows = []; let cur = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { cur.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (field || cur.length) cur.push(field.trim());
      if (cur.some(f => f)) rows.push(cur);
      cur = []; field = '';
    } else field += ch;
  }
  if (field || cur.length) { cur.push(field.trim()); if (cur.some(f => f)) rows.push(cur); }
  return rows;
}

function normalize(name) {
  return name.toLowerCase().replace(/[-–—]/g, ' ').trim();
}

function clean(name) {
  return name.replace(/\s+/g, ' ').trim();
}

module.exports = async (locationFilesDir) => {
  if (!locationFilesDir) locationFilesDir = path.join(__dirname, '../../location-files');
  if (!fs.existsSync(locationFilesDir)) {
    console.log('  ⚠ location-files directory not found, skipping location seed');
    return;
  }

  const regions = await Region.findAll();
  const regionMap = {};
  for (const r of regions) regionMap[normalize(r.name)] = r;

  const files = fs.readdirSync(locationFilesDir).filter(f => f.endsWith('.csv'));
  if (!files.length) { console.log('  ⚠ No CSV files found, skipping location seed'); return; }

  let totalDistricts = 0, totalWards = 0, totalStreets = 0;

  for (const file of files) {
    const text = fs.readFileSync(path.join(locationFilesDir, file), 'utf-8');
    const rows = parseCSV(text);
    if (rows.length < 2) continue;

    const csvRegionName = rows[1][0];
    const region = regionMap[normalize(csvRegionName)];
    if (!region) { console.warn(`  ⚠ Region "${csvRegionName}" not found, skipping ${file}`); continue; }

    // ── Districts ──────────────────────────────────────
    const districtNames = [...new Set(rows.slice(1).map(r => clean(r[2] || '')).filter(Boolean))];
    const existingDistricts = await District.findAll({ where: { name: districtNames, region_id: region.id }, attributes: ['name'], raw: true });
    const existingDistSet = new Set(existingDistricts.map(d => d.name));
    const newDistricts = districtNames.filter(n => !existingDistSet.has(n));
    if (newDistricts.length) await District.bulkCreate(newDistricts.map(n => ({ name: n, region_id: region.id })));
    totalDistricts += newDistricts.length;

    const allDistricts = await District.findAll({ where: { region_id: region.id }, raw: true });
    const districtMap = {}; for (const d of allDistricts) districtMap[d.name] = d;

    // Map each ward to its district
    const wardToDistrict = {};
    for (let i = 1; i < rows.length; i++) {
      const dn = clean(rows[i][2] || ''), wn = rows[i][4]?.trim();
      if (dn && wn) wardToDistrict[wn] = dn;
    }

    // ── Wards ──────────────────────────────────────────
    const wardNames = [...new Set(rows.slice(1).map(r => r[4]?.trim()).filter(Boolean))];
    const existingWards = await Ward.findAll({ where: { name: wardNames, region_id: region.id }, attributes: ['id', 'name', 'district_id'], raw: true });
    const existingWardSet = new Set(existingWards.map(w => w.name));
    const newWards = wardNames.filter(n => !existingWardSet.has(n));
    if (newWards.length) {
      const wardData = newWards.map(n => ({
        name: n, region_id: region.id,
        district_id: wardToDistrict[n] ? districtMap[wardToDistrict[n]]?.id : null,
      }));
      await Ward.bulkCreate(wardData);
    }
    totalWards += newWards.length;

    // Update district_id for existing wards that are missing it
    for (const w of existingWards) {
      if (!w.district_id) {
        const dId = wardToDistrict[w.name] ? districtMap[wardToDistrict[w.name]]?.id : null;
        if (dId) await Ward.update({ district_id: dId }, { where: { id: w.id } });
      }
    }

    const allWards = await Ward.findAll({ where: { region_id: region.id }, raw: true });
    const wardMap = {}; for (const w of allWards) wardMap[w.name] = w;

    // ── Streets ────────────────────────────────────────
    const streetSet = new Set();
    const streetCandidates = [];
    for (let i = 1; i < rows.length; i++) {
      const wn = rows[i][4]?.trim(), sn = rows[i][6]?.trim();
      if (!wn || !sn) continue;
      const w = wardMap[wn]; if (!w) continue;
      const key = `${w.id}:${sn}`;
      if (!streetSet.has(key)) { streetSet.add(key); streetCandidates.push({ name: sn, ward_id: w.id }); }
    }
    if (!streetCandidates.length) continue;

    const existingSt = await Street.findAll({ where: { ward_id: allWards.map(w => w.id) }, attributes: ['name', 'ward_id'], raw: true });
    const existingStSet = new Set(existingSt.map(s => `${s.ward_id}:${s.name}`));
    const newStreets = streetCandidates.filter(s => !existingStSet.has(`${s.ward_id}:${s.name}`));

    for (let i = 0; i < newStreets.length; i += 1000)
      await Street.bulkCreate(newStreets.slice(i, i + 1000));
    totalStreets += newStreets.length;
  }

  console.log(`  ✓ Seeded ${totalDistricts} districts, ${totalWards} wards, ${totalStreets} streets across ${files.length} regions`);
};
