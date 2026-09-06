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

  ROLES: ['Admin', 'General Manager', 'Director', 'Operations Manager', 'Finance', 'Sales', 'Collector', 'Technician', 'Cashier', 'Supervisor', 'HR', 'Stock Manager'],

  KITCHEN_CATEGORIES: ['meats_proteins', 'perishables', 'staples', 'seasonings', 'consumables', 'beverages', 'other'],

  KITCHEN_UNITS: ['portions', 'kg', 'qty', 'packs', 'bottles', 'liters', 'boxes', 'bags'],

  // Default kitchen item catalog (mirrors the DANTE26 DAILY KITCHEN STOCK sheet)
  KITCHEN_SEED_ITEMS: [
    // Category A: Meats & Proteins
    { name: 'Mbuzi', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Fillet', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Nundu', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Ulimi', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Supu Ng\'ombe', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Supu Utumbo', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Beef Foil', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'T-Bone', category: 'meats_proteins', default_unit: 'packs' },
    { name: 'Beef Ribs', category: 'meats_proteins', default_unit: 'kg' },
    { name: 'Kuku Broiler', category: 'meats_proteins', default_unit: 'qty' },
    { name: 'Kuku Kienyeji', category: 'meats_proteins', default_unit: 'qty' },
    { name: 'Firigisi', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Sausages', category: 'meats_proteins', default_unit: 'packs' },
    { name: 'Pork', category: 'meats_proteins', default_unit: 'kg' },
    { name: 'Prawns', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Calamari', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Samaki Baharini', category: 'meats_proteins', default_unit: 'portions' },
    { name: 'Sato', category: 'meats_proteins', default_unit: 'portions' },
    // Category B: Perishables & Fresh Produce
    { name: 'Potatoes', category: 'perishables', default_unit: 'kg' },
    { name: 'Eggs', category: 'perishables', default_unit: 'qty' },
    { name: 'Ndizi', category: 'perishables', default_unit: 'qty' },
    // Category C: Prepared / Staples
    { name: 'Ugali Portion', category: 'staples', default_unit: 'portions' },
    { name: 'Mchele (Rice)', category: 'staples', default_unit: 'kg' },
    { name: 'Chapati', category: 'staples', default_unit: 'qty' },
    { name: 'Mama Sitta', category: 'staples', default_unit: 'portions' },
    // Category D: Seasonings, Spices & Pantry Staples
    { name: 'Royco', category: 'seasonings', default_unit: 'packs' },
    { name: 'Soya Sauce', category: 'seasonings', default_unit: 'bottles' },
    { name: 'Vinegar', category: 'seasonings', default_unit: 'bottles' },
    { name: 'Chumvi (Salt)', category: 'seasonings', default_unit: 'packs' },
    { name: 'Ajina Motto', category: 'seasonings', default_unit: 'packs' },
    { name: 'BBQ Sauce', category: 'seasonings', default_unit: 'bottles' },
    { name: 'Asali (Honey)', category: 'seasonings', default_unit: 'bottles' },
    { name: 'Black Pepper', category: 'seasonings', default_unit: 'packs' },
    { name: 'Paprika', category: 'seasonings', default_unit: 'packs' },
    { name: 'Chicken Masala', category: 'seasonings', default_unit: 'packs' },
    { name: 'Garlic Powder', category: 'seasonings', default_unit: 'packs' },
    { name: 'Tomato Paste', category: 'seasonings', default_unit: 'packs' },
    { name: 'Mayonnaise', category: 'seasonings', default_unit: 'bottles' },
    { name: 'Blue Band', category: 'seasonings', default_unit: 'packs' },
    { name: 'Coconut', category: 'seasonings', default_unit: 'qty' },
    // Category E: Kitchen Consumables
    { name: 'Foil Paper', category: 'consumables', default_unit: 'packs' },
  ],

  MODULES: ['accounts', 'partners', 'shops', 'machines', 'collections', 'finance', 'inventory', 'tickets', 'staff', 'reports', 'settings', 'users'],

  ACTIONS: ['read', 'create', 'update', 'delete', 'approve'],

  PORT: process.env.PORT || 5000,
};
