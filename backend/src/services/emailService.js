const RESEND_API_URL = 'https://api.resend.com/emails';

export async function enviarInvitacion(email, link) {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#A8832E;">Hospedaje · Centenario</h2>
      <p>Se creó una cuenta para ti en el sistema de Anfitriones del Centenario.</p>
      <p>Para activarla, define tu contraseña aquí:</p>
      <p><a href="${link}" style="display:inline-block;background:#A8832E;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Crear mi contraseña</a></p>
      <p style="color:#666;font-size:13px;">Este link expira en 48 horas. Si no esperabas este correo, puedes ignorarlo.</p>
    </div>
  `;

  await enviarCorreo({
    to: email,
    subject: 'Activa tu cuenta · Hospedaje Centenario',
    html,
  });
}

async function enviarCorreo({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY o RESEND_FROM_EMAIL no están configurados.');
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Resend respondió ${res.status}: ${data.message || 'error desconocido'}`);
  }
}
