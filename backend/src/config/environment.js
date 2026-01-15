require('dotenv').config();

const config = {
  adminUsername: process.env.ADMIN_USERNAME || 'shani',
  adminPassword: process.env.ADMIN_PASSWORD || 'shani933',
  jwtSecret: process.env.JWT_SECRET || 'default_secret_change_this',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  shopDbPrefix: process.env.SHOP_DB_PREFIX || 'shop_db_',
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  jwtExpiration: '24h',
  bcryptRounds: 12,
  adminDbName: 'vapeshop_admin',
};

// Validate critical environment variables
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'default_secret_change_this') {
    console.error('ERROR: JWT_SECRET must be set in production!');
    process.exit(1);
  }
  if (config.adminPassword === 'vapeshop121!') {
    console.warn('WARNING: Default admin password detected in production! Please change immediately.');
  }
}

module.exports = config;
