const DOG_SIZES = ['small', 'medium', 'large', 'giant'];
const ENERGY_LEVELS = ['low', 'moderate', 'high'];
const PLAY_STYLES = ['gentle', 'balanced', 'rough'];
const SOCIAL_COMFORTS = ['shy', 'selective', 'social'];

function parseJsonArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (Buffer.isBuffer(value)) return parseJsonArray(value.toString('utf8'));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeChoice(value, allowed, fieldName, fallback = '') {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized) return '';
  if (!allowed.includes(normalized)) {
    const error = new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function normalizePreferredDogSizes(value) {
  const sizes = parseJsonArray(value)
    .map((size) => String(size || '').trim().toLowerCase())
    .filter(Boolean);
  const invalid = sizes.find((size) => !DOG_SIZES.includes(size));
  if (invalid) {
    const error = new Error(`preferredDogSizes must contain only: ${DOG_SIZES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return [...new Set(sizes)];
}

function normalizeDogTraits(body = {}, { partial = false } = {}) {
  const traits = {};
  const energyInput = body.energyLevel ?? body.energy_level;
  const playInput = body.playStyle ?? body.play_style;
  const comfortInput = body.socialComfort ?? body.social_comfort;
  const preferredSizesInput = body.preferredDogSizes ?? body.preferred_dog_sizes;

  if (!partial || energyInput !== undefined) {
    traits.energyLevel = normalizeChoice(energyInput, ENERGY_LEVELS, 'energyLevel', partial ? '' : 'moderate');
  }
  if (!partial || playInput !== undefined) {
    traits.playStyle = normalizeChoice(playInput, PLAY_STYLES, 'playStyle', partial ? '' : 'balanced');
  }
  if (!partial || comfortInput !== undefined) {
    traits.socialComfort = normalizeChoice(comfortInput, SOCIAL_COMFORTS, 'socialComfort', partial ? '' : 'social');
  }
  if (!partial || preferredSizesInput !== undefined) {
    traits.preferredDogSizes = normalizePreferredDogSizes(preferredSizesInput);
  }

  return traits;
}

function preferredDogSizesJson(value) {
  return JSON.stringify(normalizePreferredDogSizes(value));
}

function mapDogTraits(row = {}) {
  return {
    energyLevel: row.energy_level || 'moderate',
    playStyle: row.play_style || 'balanced',
    socialComfort: row.social_comfort || 'social',
    preferredDogSizes: normalizePreferredDogSizes(row.preferred_dog_sizes),
  };
}

module.exports = {
  DOG_SIZES,
  ENERGY_LEVELS,
  PLAY_STYLES,
  SOCIAL_COMFORTS,
  mapDogTraits,
  normalizeDogTraits,
  normalizePreferredDogSizes,
  preferredDogSizesJson,
};
