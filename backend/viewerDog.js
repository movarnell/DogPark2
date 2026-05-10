const db = require('./db');
const { isDevAuthUserId, listDevDogs } = require('./devAuthFallback');
const { mapDogTraits } = require('./dogTraits');

async function resolveViewerDog(userId, dogId) {
  if (!userId || !dogId) return null;

  if (isDevAuthUserId(userId)) {
    return listDevDogs(userId).find((dog) => String(dog.id) === String(dogId)) || null;
  }

  const [dogs] = await db.query(
    `SELECT id, owner_id, name, size, breed, breed_key, energy_level, play_style, social_comfort, preferred_dog_sizes
     FROM dogs
     WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [dogId, userId],
  );
  const dog = dogs[0];
  if (!dog) return null;
  return {
    id: dog.id,
    ownerId: dog.owner_id,
    name: dog.name,
    size: dog.size,
    breed: dog.breed || '',
    breedKey: dog.breed_key || '',
    ...mapDogTraits(dog),
  };
}

module.exports = {
  resolveViewerDog,
};
