// middleware/validate.js
const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = parsed.body || req.body;
    req.query = parsed.query || req.query;
    req.params = parsed.params || req.params;
    next();
  } catch (err) {
    const errors = err.errors?.map(e => ({ field: e.path.join('.'), message: e.message })) || [];
    return res.status(422).json({ success: false, message: 'Validation failed', errors });
  }
};

module.exports = { validate, z };
