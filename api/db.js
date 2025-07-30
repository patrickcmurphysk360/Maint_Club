const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'postgres',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;