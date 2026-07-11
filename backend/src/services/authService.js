import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export async function verifyCredentials(email, password) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash FROM usuarios WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}

export function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}
