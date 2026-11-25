const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const db = require('./config/database');
const logger = require('./utils/logger');
const { seedDatabase } = require('./utils/seed');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const aiService = require('./services/ai/aiService');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const aiRoutes = require('./routes/aiRoutes');
const callsRoutes = require('./routes/callsRoutes');
const leadsRoutes = require('./routes/leadsRoutes');
const appointmentsRoutes = require('./routes/appointmentsRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');

function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(logger.requestLogger);
  app.use('/api', apiLimiter);

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      service: 'VoxPilot AI Backend',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ai: aiService.getAIStatus(),
      database: db.getStatus(),
      company: env.companyName,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/calls', callsRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/knowledge', knowledgeRoutes);

  // Serve built frontend in production if present
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (env.nodeEnv === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use('/api/*', notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function startServer() {
  await db.connect();
  await seedDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`VoxPilot AI Backend listening on http://localhost:${env.port}`);
    logger.info(`Health endpoint: http://localhost:${env.port}/api/health`);
    logger.info(`AI Mode: ${aiService.getAIStatus().mode.toUpperCase()} (${aiService.getAIStatus().provider})`);
  });
  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start VoxPilot AI server:', err);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
