const mysql = require('mysql2');
require('dotenv').config({ quiet: true });

const pool = mysql.createPool({
  host: process.env.HOSTNAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();
