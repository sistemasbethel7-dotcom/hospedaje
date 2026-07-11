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
