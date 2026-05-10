const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const functionsRoot = path.join(__dirname, '..', '..');
const backendRoot = path.join(functionsRoot, '..', '..', 'DogPark2Backend');

function readContractFile(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const sharedRouteSnippets = {
  'app.js': [
    "app.use('/api/parks', parksRoutes)",
    "app.use('/api/dogs', dogsRoutes)",
    "app.use('/api/owners', ownersRoutes)",
    "app.use('/api/me', meRoutes)",
    "app.use('/api', relationshipsRoutes)",
    "app.use('/api', communityRoutes)",
    "app.use('/api/admin', adminRoutes)",
  ],
  'owners.js': [
    "router.post('/login'",
    "router.post('/register'",
    "router.post('/logout'",
    "router.post('/google/native'",
    "router.post('/apple/native'",
  ],
  'dogs.js': [
    "router.get('/'",
    "router.post('/'",
    "router.patch('/:id'",
    "router.delete('/:id'",
  ],
  'relationships.js': [
    "router.get('/friends'",
    "router.post('/friends/requests'",
    "router.post('/friends/requests/:id/accept'",
    "router.get('/conversations'",
    "router.post('/conversations/:id/messages'",
    "router.post('/blocks'",
  ],
  'community.js': [
    "router.get('/visits'",
    "router.post('/visits'",
    "router.post('/visits/:id/check-in'",
    "router.post('/visits/:id/interest'",
    "router.get('/reviews'",
    "router.post('/reports'",
  ],
};

test('Firebase Functions API keeps the same critical route contract as the local backend', () => {
  for (const [file, snippets] of Object.entries(sharedRouteSnippets)) {
    const functionsSource = readContractFile(functionsRoot, file);
    const backendSource = readContractFile(backendRoot, file);

    for (const snippet of snippets) {
      assert.equal(
        functionsSource.includes(snippet),
        true,
        `Functions ${file} is missing route contract: ${snippet}`,
      );
      assert.equal(
        backendSource.includes(snippet),
        true,
        `Backend ${file} is missing route contract: ${snippet}`,
      );
    }
  }
});
