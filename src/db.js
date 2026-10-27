// Conexão com o banco — PostgreSQL via DATABASE_URL.
// A interface (`query` devolvendo `{ rows }`) mantém repositório e testes iguais;
// SQL continua usando `?` como marcador; aqui convertemos para $1, $2, …
import pg from 'pg';
import { existsSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

const { Pool } = pg;

// .env da raiz do projeto; variáveis já definidas no ambiente (CI, testes) têm prioridade.
const ENV_LOCAL = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(ENV_LOCAL)) process.loadEnvFile(ENV_LOCAL);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('Defina DATABASE_URL (veja .env.example). Ex.: docker compose up -d && cp .env.example .env');
}

let pool;

function conexao() {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
    // Sem este handler, uma conexão ociosa que cai (ex.: banco reiniciado) derruba o processo.
    pool.on('error', (erro) => console.error('erro na conexão com o banco:', erro.message));
  }
  return pool;
}

// Troca todo `?` por $n — por isso o SQL não pode ter `?` literal (em strings
// ou operadores jsonb como `?|`); nesses casos, use $n direto.
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
    CREATE TABLE IF NOT EXISTS usuarios (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      senha       TEXT NOT NULL,
      perfil      TEXT NOT NULL CHECK (perfil IN ('doador', 'ong')),
      criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
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
  await conexao().query('TRUNCATE doacoes, usuarios RESTART IDENTITY');
}

export async function encerrar() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
