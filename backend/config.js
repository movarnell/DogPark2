require('dotenv').config({ quiet: true });

const DEFAULT_SESSION_SECRET = 'development-session-secret-change-before-production';

const parseCsv = (value, fallback = []) => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const defaultDevCorsOrigins = Array.from({ length: 10 }, (_, index) => 5173 + index).flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);
const configuredCorsOrigins = parseCsv(process.env.CORS_ORIGINS, []);
const corsOrigins =
  (process.env.NODE_ENV || 'development') === 'production'
    ? parseCsv(process.env.CORS_ORIGINS, [])
    : [...new Set([...configuredCorsOrigins, ...defaultDevCorsOrigins])];

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4050),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4050',
  corsOrigins,
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleIOSClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  googleOAuthRedirectUri:
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${process.env.PUBLIC_BASE_URL || 'http://localhost:4050'}/api/owners/google/callback`,
  appleOAuthClientId: process.env.APPLE_OAUTH_CLIENT_ID || '',
  appleOAuthTeamId: process.env.APPLE_OAUTH_TEAM_ID || '',
  appleOAuthKeyId: process.env.APPLE_OAUTH_KEY_ID || '',
  appleOAuthPrivateKey: (process.env.APPLE_OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  appleOAuthRedirectUri:
    process.env.APPLE_OAUTH_REDIRECT_URI ||
    `${process.env.PUBLIC_BASE_URL || 'http://localhost:4050'}/api/owners/apple/callback`,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
  sessionSecret:
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    DEFAULT_SESSION_SECRET,
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  ssl: {
    certPath: process.env.SSL_CERT_PATH || '',
    keyPath: process.env.SSL_KEY_PATH || '',
    caPath: process.env.SSL_CA_PATH || '',
  },
};

function validateProductionConfig(configToValidate) {
  if (configToValidate.nodeEnv !== 'production') return;

  if (
    !configToValidate.sessionSecret ||
    configToValidate.sessionSecret === DEFAULT_SESSION_SECRET ||
    configToValidate.sessionSecret.length < 32
  ) {
    throw new Error('SESSION_SECRET must be set to a strong production secret before starting in production');
  }

  if (process.env.AUTH_DB_FALLBACK === 'true') {
    throw new Error('AUTH_DB_FALLBACK must not be enabled in production');
  }

  if (!configToValidate.publicBaseUrl.startsWith('https://')) {
    throw new Error('PUBLIC_BASE_URL must be an HTTPS origin in production');
  }

  if (!configToValidate.frontendBaseUrl.startsWith('https://')) {
    throw new Error('FRONTEND_BASE_URL must be an HTTPS origin in production');
  }

  if (!configToValidate.corsOrigins.length) {
    throw new Error('CORS_ORIGINS must list the production web origin');
  }

  for (const origin of configToValidate.corsOrigins) {
    if (!origin.startsWith('https://')) {
      throw new Error('CORS_ORIGINS must contain HTTPS origins only in production');
    }
  }
}

validateProductionConfig(config);

module.exports = config;
module.exports.DEFAULT_SESSION_SECRET = DEFAULT_SESSION_SECRET;
module.exports.validateProductionConfig = validateProductionConfig;
