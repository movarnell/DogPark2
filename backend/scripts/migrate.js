#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'migrations');
const command = process.argv[2] || 'status';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function createConnection() {
  return mysql.createConnection({
    host: requiredEnv('HOSTNAME'),
    user: requiredEnv('USER_NAME'),
    password: process.env.PASSWORD || '',
    database: requiredEnv('DATABASE'),
    multipleStatements: true,
  });
}

async function migrationFiles() {
  const entries = await fs.readdir(migrationsDir);
  return entries.filter((entry) => entry.endsWith('.sql')).sort();
}

async function ensureTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedMigrations(connection) {
  const [rows] = await connection.query('SELECT filename, applied_at FROM schema_migrations ORDER BY filename');
  return new Map(rows.map((row) => [row.filename, row.applied_at]));
}

async function status() {
  const connection = await createConnection();
  try {
    await ensureTable(connection);
    const files = await migrationFiles();
    const applied = await appliedMigrations(connection);

    for (const file of files) {
      const marker = applied.has(file) ? 'applied' : 'pending';
      console.log(`${marker.padEnd(8)} ${file}`);
    }
  } finally {
    await connection.end();
  }
}

async function up() {
  const connection = await createConnection();
  try {
    await ensureTable(connection);
    const files = await migrationFiles();
    const applied = await appliedMigrations(connection);

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`applying ${file}`);
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    }

    console.log('migrations complete');
  } finally {
    await connection.end();
  }
}

async function baseline() {
  const connection = await createConnection();
  try {
    await ensureTable(connection);
    const files = await migrationFiles();
    const applied = await appliedMigrations(connection);

    for (const file of files) {
      if (applied.has(file)) continue;
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`baselined ${file}`);
    }

    console.log('baseline complete');
  } finally {
    await connection.end();
  }
}

async function main() {
  if (command === 'status') {
    await status();
    return;
  }
  if (command === 'up') {
    await up();
    return;
  }
  if (command === 'baseline') {
    await baseline();
    return;
  }
  throw new Error(`Unknown migration command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
