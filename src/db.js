// Conexão com o banco — PostgreSQL via DATABASE_URL.
// A interface (`query` devolvendo `{ rows }`) mantém repositório e testes iguais;
// SQL continua usando `?` como marcador; aqui convertemos para $1, $2, …
import pg from 'pg';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

function carregarEnvLocal() {
  if (process.env.DATABASE_URL) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

carregarEnvLocal();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'Defina DATABASE_URL (veja .env.example). Ex.: docker compose up -d && cp .env.example .env'
  );
}

let pool;

function conexao() {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}

function sqlComPlaceholdersPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Executa uma consulta e devolve { rows }.
 * Use `?` como marcador de parâmetro (evita injeção de SQL):
 *   query('SELECT * FROM doacoes WHERE id = ?', [id])
 */
export async function query(sql, valores = []) {
  const sqlPg = sqlComPlaceholdersPg(sql);
  const ehLeitura = /^\s*(select|with)/i.test(sql) || /returning/i.test(sql);
  const result = await conexao().query(sqlPg, valores);
  if (ehLeitura) return { rows: result.rows };
  return { rows: [], alteradas: result.rowCount ?? 0 };
}

/** Cria o schema, se ainda não existir. Rodado por `npm run db:migrar` e ao subir o servidor. */
export async function migrar() {
  await conexao().query(`
    CREATE TABLE IF NOT EXISTS doacoes (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT NOT NULL,
      quantidade  TEXT NOT NULL,
      validade    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'disponivel',
      ong         TEXT,
      criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  await conexao().query('TRUNCATE doacoes RESTART IDENTITY');
}

export async function encerrar() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
