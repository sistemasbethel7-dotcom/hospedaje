import 'dotenv/config';

const API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = 'gpt-realtime-mini';

if (!API_KEY || API_KEY === 'CHANGE_ME') {
  console.error('Falta OPENAI_API_KEY en backend/.env');
  process.exit(1);
}

async function verificarKey() {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Key inválida o sin acceso (${res.status}): ${body}`);
  }
  console.log('✓ API key válida, cuenta con acceso a la API.');
}

async function verificarRealtime() {
  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: REALTIME_MODEL,
        instructions: 'Eres un asistente de prueba.',
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`No se pudo crear sesión realtime (${res.status}): ${JSON.stringify(body)}`);
  }
  console.log(`✓ Sesión realtime creada con modelo ${REALTIME_MODEL}.`);
  console.log(`✓ Token efímero recibido (client_secret): ${body.value?.slice(0, 12)}...`);
}

async function main() {
  await verificarKey();
  await verificarRealtime();
  console.log('\nConexión con OpenAI Realtime funcionando correctamente.');
}

main().catch((err) => {
  console.error('✗ Falló la prueba de conexión:', err.message);
  process.exit(1);
});
