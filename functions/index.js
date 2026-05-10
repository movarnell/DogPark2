const { onRequest } = require('firebase-functions/v2/https');
const createApp = require('./app');

const app = createApp();

exports.api = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  app,
);
