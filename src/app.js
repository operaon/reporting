const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const routes = require('./routes');
const { requestContext, authRateLimiter, errorHandler } = require('./middlewares/operational');
const sequelize = require('./config/database');
const env = require('./config/env');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxyHops);
app.use(helmet());
app.use(cors({ origin: env.cors.origin }));
app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(requestContext);
app.use(authRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: env.serviceName, timestamp: new Date().toISOString() }));
app.get('/ready', async (_req, res, next) => {
  try {
    await sequelize.authenticate();
    return res.json({ status: 'ready', service: env.serviceName, timestamp: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
});
app.use('/api', routes);
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } }));
app.use(errorHandler);

module.exports = app;
