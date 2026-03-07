import argon2 from 'argon2';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await argon2.hash('Admin1234!');
const r = await pool.query(
  `UPDATE users SET password_hash=$1 WHERE email=$2 RETURNING id, email, role`,
  [hash, 'mebaburao888@gmail.com']
);
console.log('Done:', JSON.stringify(r.rows[0]));
await pool.end();
