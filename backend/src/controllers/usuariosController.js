import bcrypt from 'bcryptjs';
import { listUsuarios, insertUsuario, updateUsuario } from '../services/usuariosService.js';

const ROLES_VALIDOS = ['admin', 'agente', 'supervisor'];

export async function listar(req, res) {
  const usuarios = await listUsuarios();
  res.json({ usuarios });
}

export async function crear(req, res) {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Correo, contraseña y rol son requeridos.' });
  }
  if (!ROLES_VALIDOS.includes(role)) {
    return res.status(400).json({ message: 'Rol inválido.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const usuario = await insertUsuario({ email, passwordHash, role });
    res.status(201).json({ usuario });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ese correo ya está registrado.' });
    }
    throw err;
  }
}

export async function actualizar(req, res) {
  const { role, activo, password } = req.body;
  const id = Number(req.params.id);

  if (role && !ROLES_VALIDOS.includes(role)) {
    return res.status(400).json({ message: 'Rol inválido.' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (id === req.user.sub && (activo === false || (role && role !== 'admin'))) {
    return res.status(400).json({ message: 'No puedes desactivar o cambiar tu propio rol de administrador.' });
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const usuario = await updateUsuario(id, {
    role: role || null,
    activo: typeof activo === 'boolean' ? activo : null,
    passwordHash,
  });

  if (!usuario) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  res.json({ usuario });
}
