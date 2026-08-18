import {
  listUsuarios,
  insertUsuarioInvitado,
  regenerarTokenInvitacion,
  updateUsuario,
  deleteUsuario,
  setUsuarioEventos,
  getUsuario,
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
  const { email, role, nombre, telefono, eventos_ids } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: 'Correo y rol son requeridos.' });
  }
  if (!ROLES_VALIDOS.includes(role)) {
    return res.status(400).json({ message: 'Rol inválido.' });
  }

  const eventosIds = Array.isArray(eventos_ids) ? eventos_ids.map(Number).filter(Number.isInteger) : [];
  if (role === 'agente' && eventosIds.length === 0) {
    return res.status(400).json({ message: 'Selecciona al menos un evento para este agente.' });
  }

  let usuario, token;
  try {
    ({ usuario, token } = await insertUsuarioInvitado({ email, role, nombre, telefono, eventosIds }));
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
  const { role, activo, password, nombre, telefono, eventos_ids } = req.body;
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

  // eventos_ids solo se toca si el request lo trae explícitamente (arreglo). Al cambiar de rol
  // a agente sin mandarlo (ej. el <select> rápido de rol en la tabla), el usuario queda sin
  // eventos hasta el siguiente PUT que sí los incluya — el admin lo completa en ese momento
  // desde el modal "Editar eventos".
  const eventosIds = Array.isArray(eventos_ids) ? eventos_ids.map(Number).filter(Number.isInteger) : null;
  if (eventosIds !== null) {
    const actual = await getUsuario(id);
    if (!actual) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    const rolEfectivo = role || actual.role;
    if (rolEfectivo === 'agente' && eventosIds.length === 0) {
      return res.status(400).json({ message: 'Selecciona al menos un evento para este agente.' });
    }
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const usuario = await updateUsuario(id, {
    role: role || null,
    activo: typeof activo === 'boolean' ? activo : null,
    passwordHash,
    nombre: typeof nombre === 'string' ? nombre : null,
    telefono: typeof telefono === 'string' ? telefono : null,
  });

  if (!usuario) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  if (eventosIds !== null) {
    await setUsuarioEventos(id, eventosIds);
  }

  res.json({ usuario });
}

export async function eliminar(req, res) {
  const id = Number(req.params.id);

  if (id === req.user.sub) {
    return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
  }

  const eliminado = await deleteUsuario(id);

  if (!eliminado) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  res.json({ ok: true });
}
