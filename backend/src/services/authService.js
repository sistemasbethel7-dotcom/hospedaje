import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export class CuentaDesactivadaError extends Error {}

export async function verifyCredentials(email, password) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role, activo FROM usuarios WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  if (!user.activo) {
    throw new CuentaDesactivadaError('Tu cuenta está desactivada. Contacta al administrador.');
  }

  return user;
}

export function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}
