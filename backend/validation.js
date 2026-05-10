function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
}

function toOptionalJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function normalizeOptionalUrl(value, fieldName = 'URL') {
  if (value === undefined || value === null || value === '') return null;
  const trimmed = String(value).trim();
  if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      const error = new Error(`${fieldName} must use http or https`);
      error.statusCode = 400;
      throw error;
    }
    return parsed.toString();
  } catch (error) {
    if (error.statusCode) throw error;
    const invalidUrlError = new Error(`${fieldName} must be a valid URL`);
    invalidUrlError.statusCode = 400;
    throw invalidUrlError;
  }
}

function handleRouteError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Unexpected server error' : error.message,
    detail: process.env.NODE_ENV === 'production' ? undefined : error.message,
  });
}

module.exports = {
  handleRouteError,
  isEmail,
  normalizeOptionalUrl,
  normalizeBoolean,
  requireFields,
  toOptionalJson,
};
