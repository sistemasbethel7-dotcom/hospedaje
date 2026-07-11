const API_BASE = '/api';

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Correo o contraseña incorrectos.');
  }

  return res.json();
}

export async function me(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Sesión inválida.');
  }

  return res.json();
}

export async function crearEvento(token, payload) {
  const res = await fetch(`${API_BASE}/eventos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo crear el evento.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function listarEventos(token, estatus) {
  const url = estatus ? `${API_BASE}/eventos?estatus=${estatus}` : `${API_BASE}/eventos`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudo cargar la lista de eventos.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function obtenerEvento(token, id) {
  const res = await fetch(`${API_BASE}/eventos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudo cargar el evento.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function actualizarEvento(token, id, payload) {
  const res = await fetch(`${API_BASE}/eventos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo actualizar el evento.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function obtenerMetricasEvento(token, id) {
  const res = await fetch(`${API_BASE}/eventos/${id}/metricas`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudieron cargar las métricas del evento.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function listarUsuarios(token) {
  const res = await fetch(`${API_BASE}/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudo cargar la lista de usuarios.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function crearUsuario(token, payload) {
  const res = await fetch(`${API_BASE}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo crear el usuario.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function actualizarUsuario(token, id, payload) {
  const res = await fetch(`${API_BASE}/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo actualizar el usuario.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function crearHogar(token, formData) {
  const res = await fetch(`${API_BASE}/hogares`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo guardar el registro.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function listarHogares(token, eventoId) {
  const res = await fetch(`${API_BASE}/hogares?evento_id=${eventoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudo cargar la lista de hogares.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function obtenerHogar(token, id) {
  const res = await fetch(`${API_BASE}/hogares/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error('No se pudo cargar el registro.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function actualizarHogar(token, id, formData) {
  const res = await fetch(`${API_BASE}/hogares/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo actualizar el registro.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function eliminarHogar(token, id) {
  const res = await fetch(`${API_BASE}/hogares/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo eliminar el registro.');
    error.status = res.status;
    throw error;
  }
}

export async function registrarIngreso(token, hogarId, cantidad) {
  const res = await fetch(`${API_BASE}/hogares/${hogarId}/ingresos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cantidad }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || 'No se pudo registrar el ingreso.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}
