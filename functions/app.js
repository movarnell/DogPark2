const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const parksRoutes = require('./parks');
const dogsRoutes = require('./dogs');
const mediaRoutes = require('./media');
const ownersRoutes = require('./owners');
const communityRoutes = require('./community');
const relationshipsRoutes = require('./relationships');
const adminRoutes = require('./admin');
const meRoutes = require('./me');
const { optionalAuth } = require('./auth');
const devToolsRoutes = config.nodeEnv === 'production' ? null : require('./devTools');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later' },
    }),
  );
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later' },
  });
  app.use('/api/owners/login', authRateLimit);
  app.use('/api/owners/register', authRateLimit);
  app.use('/api/owners/google/native', authRateLimit);
  app.use('/api/owners/google/callback', authRateLimit);
  app.use('/api/owners/apple/native', authRateLimit);
  app.use('/api/owners/apple/callback', authRateLimit);
  app.use(optionalAuth);

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'dog-park-api',
      environment: config.nodeEnv,
      googlePlacesConfigured: Boolean(config.googlePlacesApiKey),
      checkedAt: new Date().toISOString(),
    });
  });

  app.use('/api/parks', parksRoutes);
  app.use('/api/dogs', dogsRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/owners', ownersRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api', relationshipsRoutes);
  app.use('/api', communityRoutes);
  app.use('/api/admin', adminRoutes);
  if (devToolsRoutes) {
    app.use('/api/dev', devToolsRoutes);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || error.status || 500;
    res.status(status).json({
      error: status < 500 ? error.message : 'Unexpected server error',
      detail: config.nodeEnv === 'production' ? undefined : error.message,
    });
  });

  return app;
}

module.exports = createApp;
