const partnerService = require('../services/partner.service');

exports.listPartners = async (req, res, next) => {
  try {
    const data = await partnerService.listPartners(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.listOwnPartners = async (req, res, next) => {
  try {
    const data = await partnerService.listPartners({ type: 'own' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createPartner = async (req, res, next) => {
  try {
    const partner = await partnerService.createPartner(req.body, req.files);
    res.status(201).json({ success: true, data: partner });
  } catch (err) { next(err); }
};

exports.updatePartner = async (req, res, next) => {
  try {
    const partner = await partnerService.updatePartner(req.params.id, req.body, req.files);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
    res.json({ success: true, data: partner });
  } catch (err) { next(err); }
};

exports.getPartner = async (req, res, next) => {
  try {
    const partner = await partnerService.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
    res.json({ success: true, data: partner });
  } catch (err) { next(err); }
};

exports.deletePartner = async (req, res, next) => {
  try {
    const ok = await partnerService.deletePartner(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Partner not found' });
    res.json({ success: true, message: 'Partner deactivated' });
  } catch (err) { next(err); }
};

exports.listShops = async (req, res, next) => {
  try {
    const data = await partnerService.listShops(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createShop = async (req, res, next) => {
  try {
    const shop = await partnerService.createShop(req.body, req.files);
    res.status(201).json({ success: true, data: shop });
  } catch (err) { next(err); }
};

exports.updateShop = async (req, res, next) => {
  try {
    const shop = await partnerService.updateShop(req.params.id, req.body, req.files);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
};

exports.getShop = async (req, res, next) => {
  try {
    const shop = await partnerService.getShop(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
};

exports.deleteShop = async (req, res, next) => {
  try {
    const ok = await partnerService.deleteShop(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.listRegions = async (req, res, next) => {
  try {
    const regions = await partnerService.listRegions();
    res.json({ success: true, data: regions });
  } catch (err) { next(err); }
};

exports.listDistricts = async (req, res, next) => {
  try {
    const districts = await partnerService.listDistricts(req.query.region_id);
    res.json({ success: true, data: districts });
  } catch (err) { next(err); }
};

exports.listWards = async (req, res, next) => {
  try {
    const wards = await partnerService.listWards(req.query.district_id);
    res.json({ success: true, data: wards });
  } catch (err) { next(err); }
};

exports.listStreets = async (req, res, next) => {
  try {
    const streets = await partnerService.listStreets(req.query.ward_id);
    res.json({ success: true, data: streets });
  } catch (err) { next(err); }
};
