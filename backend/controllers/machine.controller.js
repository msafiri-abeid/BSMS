const machineService = require('../services/machine.service');

const list = async (req, res, next) => {
  try {
    const data = await machineService.list(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const machine = await machineService.getOne(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const machine = await machineService.create(req.body);
    res.status(201).json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const machine = await machineService.update(req.params.id, req.body);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const deploy = async (req, res, next) => {
  try {
    const result = await machineService.deploy(req.params.id, req.body, req.user.id);
    if (!result) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const exchange = async (req, res, next) => {
  try {
    const result = await machineService.exchange(req.params.id, req.body, req.user.id);
    if (!result) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const refill = async (req, res, next) => {
  try {
    const result = await machineService.refill(req.params.id, req.body, req.user.id);
    if (!result) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getMachineStats = async (req, res, next) => {
  try {
    const stats = await machineService.getMachineStats(req.params.id, req.query);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const deleted = await machineService.remove(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, message: 'Machine deleted successfully' });
  } catch (err) { next(err); }
};



const exportExcel = async (req, res, next) => {
  try {
    const buffer = await machineService.exportExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="machines.xlsx"',
    });
    res.send(buffer);
  } catch (err) { next(err); }
};

const downloadPDF = async (req, res, next) => {
  try {
    const buffer = await machineService.generateMachinePDF(req.params.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="machine-${req.params.id}-report.pdf"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
};

const recordCollection = async (req, res, next) => {
  try {
    const allowed = ['Admin', 'General Manager', 'Operations Manager'];
    if (!allowed.includes(req.user.role?.name)) {
      return res.status(403).json({ success: false, message: 'Only Admin, General Manager, or Operations Manager can record collections manually' });
    }
    const collection = await machineService.recordCollection({
      machineId: req.params.id,
      shopId: req.body.shop_id,
      userId: req.user.id,
      currCount: req.body.curr_count,
      novomaticData: req.body.novomatic_data ? JSON.parse(req.body.novomatic_data) : null,
      collectionDate: req.body.collection_date || undefined,
    });
    res.status(201).json({ success: true, data: collection });
  } catch (err) { next(err); }
};

module.exports = { list, getOne, getMachineStats, create, update, remove, deploy, exchange, refill, exportExcel, downloadPDF, recordCollection };
