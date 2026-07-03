require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'bentabet-jwt-secret-change-in-production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'bentabet-refresh-secret-change-in-production',
  JWT_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',

  BCRYPT_ROUNDS: 12,

  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: process.env.DB_PORT || 3306,
    NAME: process.env.DB_NAME || 'bentabet_db',
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || '',
    POOL: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },

  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET,
  },

  BEEM_AFRICA: {
    API_KEY: process.env.BEEM_API_KEY,
    SECRET: process.env.BEEM_SECRET,
    SENDER_NAME: process.env.BEEM_SENDER_NAME || 'BENTABET',
    BASE_URL: 'https://apisms.beem.africa/v1',
  },

  DEFAULT_WEEKLY_TARGET: 120000, // TZS
  DEFAULT_CREDIT_VALUES: {
    Meteora: 200,
    Novomatic: 10,
  },

  SLA_HOURS: {
    urgent: 12,
    high: 24,
    medium: 48,
    low: 72,
  },

  ROLES: ['Admin', 'General Manager', 'Director', 'Operations Manager', 'Finance', 'Sales', 'Collector', 'Technician', 'Cashier', 'Supervisor'],

  MODULES: ['accounts', 'partners', 'shops', 'machines', 'collections', 'finance', 'inventory', 'tickets', 'staff', 'reports', 'settings', 'users'],

  ACTIONS: ['read', 'create', 'update', 'delete', 'approve'],

  PORT: process.env.PORT || 5000,
};
