import { verifyCredentials, generateToken } from '../services/authService.js';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos.' });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
  }

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
}
