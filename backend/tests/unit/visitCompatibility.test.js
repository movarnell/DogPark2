const assert = require('node:assert/strict');
const test = require('node:test');
const { computeVisitCompatibility } = require('../../visitCompatibility');
const { presentVisit } = require('../../visitPrivacy');

test('scores compatible visits using size, preferences, energy, play style, and social comfort', () => {
  const compatibility = computeVisitCompatibility(
    {
      id: 'viewer-dog',
      name: 'Maple',
      size: 'medium',
      breed: 'Retriever mix',
      energyLevel: 'high',
      playStyle: 'balanced',
      socialComfort: 'social',
      preferredDogSizes: ['medium', 'large'],
    },
    {
      id: 'visit-1',
      dog_name: 'Pepper',
      dog_size: 'medium',
      dog_breed: 'Retriever mix',
      dog_energy_level: 'high',
      dog_play_style: 'balanced',
      dog_social_comfort: 'social',
      dog_preferred_sizes: ['medium'],
    },
  );

  assert.equal(compatibility.tier, 'best');
  assert.equal(compatibility.score >= 50, true);
  assert.equal(compatibility.reasons.some((reason) => reason.includes('Same size')), true);
  assert.equal(compatibility.reasons.some((reason) => reason.includes('Similar energy')), true);
});

test('breed matching uses canonical keys for common aliases and mixes', () => {
  const compatibility = computeVisitCompatibility(
    {
      id: 'dog-1',
      name: 'Maple',
      size: 'medium',
      breed: 'Lab mix',
    },
    {
      id: 'visit-1',
      dog_name: 'Scout',
      dog_size: 'large',
      dog_breed: 'Labrador Retriever',
    },
  );

  assert.equal(compatibility.reasons.some((reason) => reason.includes('Same breed')), true);
});

test('does not score hidden dog traits after privacy shaping', () => {
  const anonymousVisit = presentVisit(
    {
      id: 'visit-2',
      owner_user_id: 99,
      username: 'owner',
      full_name: 'Owner',
      dog_id: 'dog-2',
      dog_name: 'Hidden',
      dog_size: 'medium',
      dog_breed: 'Retriever mix',
      dog_energy_level: 'high',
      dog_play_style: 'rough',
      dog_social_comfort: 'social',
      dog_preferred_sizes: ['medium'],
      messages_enabled: 1,
      activity_visibility: 'anonymous',
      is_friend: 0,
    },
    '42',
  );

  const compatibility = computeVisitCompatibility(
    {
      id: 'viewer-dog',
      name: 'Maple',
      size: 'medium',
      breed: 'Retriever mix',
      energyLevel: 'high',
      playStyle: 'balanced',
      socialComfort: 'social',
      preferredDogSizes: ['medium'],
    },
    anonymousVisit,
  );

  assert.equal(anonymousVisit.dog_name, '');
  assert.equal(compatibility.score, 0);
  assert.deepEqual(compatibility.reasons, []);
});
