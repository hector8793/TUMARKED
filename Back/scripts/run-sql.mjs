import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const file = process.argv[2];
if (!file) throw new Error('Indica el archivo SQL.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(await readFile(new URL(file, import.meta.url), 'utf8'));
  console.log(`SQL aplicado: ${file}`);
} finally {
  await client.end();
}

