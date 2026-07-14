import {
  listUsuarios,
  insertUsuarioInvitado,
  regenerarTokenInvitacion,
  updateUsuario,
} from '../services/usuariosService.js';
import { enviarInvitacion } from '../services/emailService.js';
import bcrypt from 'bcryptjs';

const ROLES_VALIDOS = ['admin', 'agente', 'supervisor'];

function linkInvitacion(token) {
  return `${process.env.FRONTEND_URL}/set-password.html?token=${token}`;
}

export async function listar(req, res) {
  const usuarios = await listUsuarios();
  res.json({ usuarios });
}

export async function crear(req, res) {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: 'Correo y rol son requeridos.' });
  }
  if (!ROLES_VALIDOS.includes(role)) {
    return res.status(400).json({ message: 'Rol inválido.' });
  }

  let usuario, token;
  try {
    ({ usuario, token } = await insertUsuarioInvitado({ email, role }));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ese correo ya está registrado.' });
    }
    throw err;
  }

  try {
    await enviarInvitacion(usuario.email, linkInvitacion(token));
  } catch (err) {
    console.error('No se pudo enviar el correo de invitación:', err);
    return res.status(201).json({
      usuario,
      avisoCorreo: 'El usuario se creó, pero no se pudo enviar el correo de invitación. Usa "Reenviar invitación".',
    });
  }

  res.status(201).json({ usuario });
}

export async function reenviarInvitacion(req, res) {
  const id = Number(req.params.id);
  const resultado = await regenerarTokenInvitacion(id);

  if (!resultado) {
    return res.status(404).json({ message: 'Usuario no encontrado o ya tiene contraseña configurada.' });
  }

  await enviarInvitacion(resultado.usuario.email, linkInvitacion(resultado.token));
  res.json({ ok: true });
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
