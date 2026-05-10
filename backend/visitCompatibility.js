const { canonicalBreedKey } = require('./breedCatalog');
const { normalizePreferredDogSizes } = require('./dogTraits');

const ENERGY_ORDER = { low: 0, moderate: 1, high: 2 };

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function dogName(dog) {
  return dog?.name || dog?.dog_name || 'your dog';
}

function preferredSizes(dog) {
  return normalizePreferredDogSizes(dog?.preferredDogSizes ?? dog?.preferred_dog_sizes);
}

function addReason(reasons, score, label) {
  reasons.push(label);
  return score;
}

function computeVisitCompatibility(viewerDog, visit) {
  if (!viewerDog || !visit?.id) return null;

  const viewerSize = normalizeText(viewerDog.size);
  const visitSize = normalizeText(visit.dog_size);
  const viewerBreed = normalizeText(viewerDog.breedKey ?? viewerDog.breed_key) || canonicalBreedKey(viewerDog.breed);
  const visitBreed = normalizeText(visit.dog_breed_key) || canonicalBreedKey(visit.dog_breed);
  const viewerEnergy = normalizeText(viewerDog.energyLevel ?? viewerDog.energy_level);
  const visitEnergy = normalizeText(visit.dog_energy_level);
  const viewerPlayStyle = normalizeText(viewerDog.playStyle ?? viewerDog.play_style);
  const visitPlayStyle = normalizeText(visit.dog_play_style);
  const viewerComfort = normalizeText(viewerDog.socialComfort ?? viewerDog.social_comfort);
  const visitComfort = normalizeText(visit.dog_social_comfort);
  const viewerPreferredSizes = preferredSizes(viewerDog);
  const visitPreferredSizes = normalizePreferredDogSizes(visit.dog_preferred_sizes);
  const reasons = [];
  const cautions = [];
  let score = 0;

  if (viewerBreed && visitBreed && viewerBreed === visitBreed) {
    score += addReason(reasons, 24, `Same breed: ${visit.dog_breed}`);
  }
  if (viewerSize && visitSize && viewerSize === visitSize) {
    score += addReason(reasons, 20, `Same size: ${visit.dog_size}`);
  }
  if (viewerPreferredSizes.includes(visitSize)) {
    score += addReason(reasons, 18, `${dogName(viewerDog)} prefers ${visit.dog_size} dogs`);
  }
  if (visitPreferredSizes.includes(viewerSize)) {
    score += addReason(reasons, 14, `${visit.dog_name || 'This dog'} prefers ${viewerDog.size} dogs`);
  }
  if (viewerEnergy && visitEnergy) {
    const difference = Math.abs((ENERGY_ORDER[viewerEnergy] ?? 1) - (ENERGY_ORDER[visitEnergy] ?? 1));
    if (difference === 0) {
      score += addReason(reasons, 14, `Similar energy: ${visitEnergy}`);
    } else if (difference === 1) {
      score += addReason(reasons, 7, 'Energy levels are close');
    } else {
      cautions.push('Energy levels may be far apart');
    }
  }
  if (viewerPlayStyle && visitPlayStyle) {
    if (viewerPlayStyle === visitPlayStyle) {
      score += addReason(reasons, 14, `Similar play style: ${visitPlayStyle}`);
    } else if (viewerPlayStyle === 'gentle' && visitPlayStyle === 'rough') {
      cautions.push('Rough play style');
    } else if (viewerPlayStyle === 'rough' && visitPlayStyle === 'gentle') {
      cautions.push('Needs gentler play');
    }
  }
  if (viewerComfort && visitComfort) {
    if (viewerComfort === visitComfort) {
      score += addReason(reasons, 10, `Similar social comfort: ${visitComfort}`);
    } else if (viewerComfort === 'shy' || visitComfort === 'shy') {
      cautions.push('One dog may need a calmer intro');
    }
  }

  const cappedScore = Math.min(100, score);
  const tier = cappedScore >= 50 ? 'best' : cappedScore >= 24 ? 'good' : 'open';

  return {
    score: cappedScore,
    tier,
    reasons,
    cautions,
  };
}

function attachCompatibility(visits, viewerDog) {
  if (!viewerDog) return visits;
  return visits.map((visit) => ({
    ...visit,
    compatibility: computeVisitCompatibility(viewerDog, visit),
  }));
}

module.exports = {
  attachCompatibility,
  computeVisitCompatibility,
};
