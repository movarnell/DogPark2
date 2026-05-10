const fs = require('fs');
const https = require('https');
const createApp = require('./app');
const config = require('./config');

const app = createApp();

function canStartHttps() {
  return (
    config.ssl.certPath &&
    config.ssl.keyPath &&
    fs.existsSync(config.ssl.certPath) &&
    fs.existsSync(config.ssl.keyPath)
  );
}

if (canStartHttps()) {
  const options = {
    key: fs.readFileSync(config.ssl.keyPath),
    cert: fs.readFileSync(config.ssl.certPath),
  };
  if (config.ssl.caPath && fs.existsSync(config.ssl.caPath)) {
    options.ca = fs.readFileSync(config.ssl.caPath);
  }

  https.createServer(options, app).listen(config.port, () => {
    console.log(`HTTPS API server running on port ${config.port}`);
  });
} else {
  app.listen(config.port, () => {
    console.log(`HTTP API server running on port ${config.port}`);
  });
}
