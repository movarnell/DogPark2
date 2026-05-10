const bcrypt = require('bcrypt');
const express = require('express');
const config = require('./config');
const {
  clearDevPasswordUsersByEmailPrefix,
  createDevDog,
  createDevPasswordUser,
  createDevVisit,
} = require('./devAuthFallback');

const router = express.Router();

const LAKE_ATALANTA_PLACE_ID = 'ChIJDUatXq0XyYcRhVEF40CQ6Mk';
const TEST_PASSWORD = 'TestPass123!';

const users = [
  { name: 'Avery Test', email: 'test.lake01@example.com', username: 'avery_test', dogs: [['Maple', 'medium', 'Golden mix']] },
  { name: 'Brooke Test', email: 'test.lake02@example.com', username: 'brooke_test', dogs: [['Scout', 'large', 'Labrador']] },
  { name: 'Casey Test', email: 'test.lake03@example.com', username: 'casey_test', dogs: [['Poppy', 'small', 'Corgi mix']] },
  { name: 'Devon Test', email: 'test.lake04@example.com', username: 'devon_test', dogs: [['Ranger', 'large', 'Great Pyrenees mix']] },
  {
    name: 'Emery Test',
    email: 'test.lake05@example.com',
    username: 'emery_test',
    dogs: [
      ['Juniper', 'medium', 'Australian Shepherd'],
      ['River', 'small', 'Terrier mix'],
    ],
  },
  {
    name: 'Finley Test',
    email: 'test.lake06@example.com',
    username: 'finley_test',
    dogs: [
      ['Biscuit', 'small', 'Beagle'],
      ['Otis', 'large', 'Boxer mix'],
    ],
  },
  { name: 'Gray Test', email: 'test.lake07@example.com', username: 'gray_test', dogs: [['Sage', 'medium', 'Border Collie']] },
  { name: 'Harper Test', email: 'test.lake08@example.com', username: 'harper_test', dogs: [['Noodle', 'small', 'Dachshund']] },
  {
    name: 'Jordan Test',
    email: 'test.lake09@example.com',
    username: 'jordan_test',
    dogs: [
      ['Maggie', 'medium', 'Spaniel mix'],
      ['Blue', 'large', 'Pit mix'],
      ['Pip', 'small', 'Chihuahua mix'],
    ],
  },
  { name: 'Kendall Test', email: 'test.lake10@example.com', username: 'kendall_test', dogs: [['Finn', 'medium', 'Rescue mix']] },
];

const intents = ['Open to play', 'Small dog meetup', 'Training/socializing', 'Just walking', 'Quiet visit'];
const schedule = [
  [0, 17, 30, 60],
  [1, 7, 0, 45],
  [2, 18, 0, 90],
  [3, 6, 45, 60],
  [4, 17, 45, 90],
  [6, 9, 30, 120],
  [7, 16, 0, 60],
  [9, 18, 15, 45],
  [11, 8, 30, 90],
  [13, 10, 0, 120],
];

function dateInDays(daysFromNow, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

router.post('/seed-test-visits', async (_req, res) => {
  if (config.nodeEnv === 'production') {
    return res.status(404).json({ error: 'Route not found' });
  }

  clearDevPasswordUsersByEmailPrefix('test.owner');
  clearDevPasswordUsersByEmailPrefix('test.lake');
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const createdUsers = [];
  let createdDogs = 0;
  let createdVisits = 0;

  users.forEach((seedUser, userIndex) => {
    const user = createDevPasswordUser({ ...seedUser, fullName: seedUser.name, passwordHash });
    const dogs = seedUser.dogs.map(([name, size, breed]) => {
      createdDogs += 1;
      return createDevDog(user.id, {
        name,
        size,
        breed,
        isFriendly: true,
        isPuppy: false,
        isPublic: true,
        notes: `${name} is part of the local test schedule.`,
      });
    });

    const [daysFromNow, hour, minute, durationMinutes] = schedule[userIndex];
    const startsAt = dateInDays(daysFromNow, hour, minute);

    dogs.forEach((dog) => {
      createDevVisit(user, {
        parkId: LAKE_ATALANTA_PLACE_ID,
        dogId: dog.id,
        startsAt,
        durationMinutes,
        socialIntent: intents[userIndex % intents.length],
        notes: `${seedUser.name} plans to be at Lake Atalanta with ${dog.name || dog.dog_name || dog.id}.`,
      });
      createdVisits += 1;
    });

    createdUsers.push({
      id: user.id,
      name: seedUser.name,
      email: seedUser.email,
      username: seedUser.username,
      dogCount: dogs.length,
    });
  });

  res.status(201).json({
    users: createdUsers,
    dogCount: createdDogs,
    visitCount: createdVisits,
    password: TEST_PASSWORD,
    parks: [
      { name: 'Lake Atalanta Dog Park', googlePlaceId: LAKE_ATALANTA_PLACE_ID },
    ],
  });
});

module.exports = router;
