const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

function runNode(script, storePath) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DEV_AUTH_FALLBACK_STORE: storePath,
    },
  });

  if (result.status !== 0) {
    throw new Error(`${result.stderr}\n${result.stdout}`);
  }

  return result.stdout.trim();
}

test('development fallback persists profile settings and dogs across backend restarts', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dogpark-dev-persist-'));
  const storePath = path.join(tempDir, 'fallback-state.json');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  runNode(
    `
      const {
        createDevPasswordUser,
        createDevDog,
        updateDevUser,
      } = require('./devAuthFallback');
      const user = createDevPasswordUser({
        fullName: 'Persistence Owner',
        email: 'Persist.Owner@example.com',
        username: 'persist_owner',
        passwordHash: 'hashed-password',
      });
      updateDevUser(user.id, {
        fullName: 'Updated Owner',
        bio: 'Weeknight regular',
        homeCity: 'Rogers, AR',
        messagesEnabled: false,
        activityVisibility: 'dog_only',
      });
      createDevDog(user.id, {
        name: 'Maple',
        size: 'medium',
        breed: 'Golden mix',
        notes: 'Likes calmer introductions',
      });
    `,
    storePath,
  );

  const output = runNode(
    `
      const assert = require('node:assert/strict');
      const {
        findDevPasswordUserByEmail,
        listDevDogs,
        publicDevUser,
      } = require('./devAuthFallback');
      const user = findDevPasswordUserByEmail('persist.owner@example.com');
      assert.ok(user);
      const publicUser = publicDevUser(user);
      const dogs = listDevDogs(user.id);
      assert.equal(publicUser.fullName, 'Updated Owner');
      assert.equal(publicUser.bio, 'Weeknight regular');
      assert.equal(publicUser.homeCity, 'Rogers, AR');
      assert.equal(publicUser.messagesEnabled, false);
      assert.equal(publicUser.activityVisibility, 'dog_only');
      assert.equal(dogs.length, 1);
      assert.equal(dogs[0].name, 'Maple');
      assert.equal(dogs[0].breed, 'Golden mix');
      console.log('ok');
    `,
    storePath,
  );

  assert.equal(output, 'ok');
});
