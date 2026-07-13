import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../src/db/codigos_postales.csv.gz');
const BATCH_SIZE = 2000;

function parseCsv() {
  const raw = gunzipSync(readFileSync(CSV_PATH)).toString('utf-8');
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split('|'));
}

async function importar() {
  const filas = parseCsv();
  console.log(`Importando ${filas.length} códigos postales...`);

  await pool.query('TRUNCATE codigos_postales');

  for (let i = 0; i < filas.length; i += BATCH_SIZE) {
    const lote = filas.slice(i, i + BATCH_SIZE);
    const valores = [];
    const params = [];
    lote.forEach((fila, idx) => {
      const [cp, colonia, tipoAsentamiento, municipio, estado] = fila;
      const base = idx * 5;
      valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
      params.push(cp, colonia, tipoAsentamiento || null, municipio || null, estado);
    });
    await pool.query(
      `INSERT INTO codigos_postales (cp, colonia, tipo_asentamiento, municipio, estado) VALUES ${valores.join(',')}`,
      params
    );
    process.stdout.write(`\r${Math.min(i + BATCH_SIZE, filas.length)}/${filas.length}`);
  }

  console.log('\nListo.');
  await pool.end();
}

importar().catch((err) => {
  console.error('Error al importar códigos postales:', err);
  process.exit(1);
});
