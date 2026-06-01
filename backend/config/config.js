require('dotenv').config();
module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bentabet_db',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    define: { underscored: true, timestamps: true },
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    define: { underscored: true, timestamps: true },
  },
};
