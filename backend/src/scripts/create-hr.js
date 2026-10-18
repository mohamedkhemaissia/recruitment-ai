import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const firstName = argument('first-name')?.trim();
const lastName = argument('last-name')?.trim();
const email = argument('email')?.trim().toLowerCase();
const password = argument('password');

try {
  if (!firstName || !lastName || !email || !password || password.length < 8) {
    throw new Error('Paramètres requis : --first-name, --last-name, --email et --password (8 caractères minimum).');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'hr')`,
    [firstName, lastName, email, passwordHash],
  );
  console.log(`Compte RH créé pour ${email}.`);
} catch (error) {
  if (error.code === '23505') {
    console.error('Création impossible : cette adresse e-mail existe déjà.');
  } else {
    console.error('Création impossible :', error.message);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
