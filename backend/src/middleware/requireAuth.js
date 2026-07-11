import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No autenticado.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
}

// EventSource no permite mandar encabezados personalizados, así que el stream SSE
// recibe el token por query string en vez de Authorization.
export function requireAuthQuery(req, res, next) {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'No autenticado.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
}
