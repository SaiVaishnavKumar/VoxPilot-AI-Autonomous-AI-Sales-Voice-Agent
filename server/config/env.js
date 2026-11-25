const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath, override: true });
}

const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'voxpilot-local-dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbMode: (process.env.DB_MODE || 'auto').toLowerCase(),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxpilot_ai',
  sqlitePath: path.resolve(__dirname, '..', process.env.SQLITE_PATH || './data/voxpilot.db'),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  companyName: process.env.COMPANY_NAME || 'Horizon Crest Realty',
  defaultIndustry: process.env.DEFAULT_INDUSTRY || 'real-estate',
};

module.exports = env;
