import bcrypt from 'bcryptjs';
import {
  verifyCredentials,
  generateToken,
  CuentaDesactivadaError,
  PasswordNoConfiguradaError,
} from '../services/authService.js';
import { buscarPorTokenInvitacion, establecerPasswordDesdeToken } from '../services/usuariosService.js';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos.' });
  }

  let user;
  try {
    user = await verifyCredentials(email, password);
  } catch (err) {
    if (err instanceof CuentaDesactivadaError) {
      return res.status(403).json({ message: err.message });
    }
    if (err instanceof PasswordNoConfiguradaError) {
      return res.status(403).json({ message: err.message });
    }
    throw err;
  }
  if (!user) {
    return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
  }

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
}

export function me(req, res) {
  res.json({ user: { id: req.user.sub, email: req.user.email, role: req.user.role } });
}

export async function validarTokenInvitacion(req, res) {
  const usuario = await buscarPorTokenInvitacion(req.params.token);
  if (!usuario) {
    return res.status(400).json({ message: 'El link de invitación es inválido o ya expiró.' });
  }
  res.json({ email: usuario.email });
}

export async function establecerPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token y contraseña son requeridos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await establecerPasswordDesdeToken(token, passwordHash);

  if (!usuario) {
    return res.status(400).json({ message: 'El link de invitación es inválido o ya expiró.' });
  }
  if (!usuario.activo) {
    return res.status(403).json({ message: 'Tu cuenta está desactivada. Contacta al administrador.' });
  }

  const jwtToken = generateToken(usuario);
  res.json({ token: jwtToken, user: { id: usuario.id, email: usuario.email, role: usuario.role } });
}
