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

// Migrações versionadas (ADR 0009). Cada uma roda uma única vez, em ordem, e fica
// registrada em `schema_migracoes`. Nunca edite uma migração já integrada na main:
// crie a próxima. A 1 usa IF NOT EXISTS porque bancos criados antes deste controle
// já têm essas tabelas.
export const MIGRACOES = [
  {
    versao: 1,
    nome: 'schema inicial (usuarios e doacoes)',
    sql: `
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
      );
    `
  },
  {
    versao: 2,
    nome: 'H5c: doação guarda quem publicou e histórico de status',
    // doador_id é opcional porque doações antigas não têm essa informação.
    sql: `
      ALTER TABLE doacoes ADD COLUMN doador_id INTEGER REFERENCES usuarios (id);
      CREATE INDEX doacoes_doador_id_idx ON doacoes (doador_id);
      CREATE TABLE historico_doacao (
        id               SERIAL PRIMARY KEY,
        doacao_id        INTEGER NOT NULL REFERENCES doacoes (id) ON DELETE CASCADE,
        status_anterior  TEXT NOT NULL,
        status_novo      TEXT NOT NULL,
        motivo           TEXT,
        registrado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX historico_doacao_doacao_id_idx ON historico_doacao (doacao_id);
    `
  }
];

// Número arbitrário e fixo: identifica o lock de migração do Prato Cheio.
const LOCK_MIGRACAO = 20261104;

/**
 * Aplica as migrações pendentes. Rodado por `npm run db:migrar` e ao subir o servidor.
 * Cada migração roda numa transação: se falhar, nada dela fica no banco.
 * O advisory lock impede que dois processos (ex.: dois servidores subindo) migrem ao mesmo tempo.
 */
export async function migrar() {
  const cliente = await conexao().connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [LOCK_MIGRACAO]);
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS schema_migracoes (
        versao       INTEGER PRIMARY KEY,
        nome         TEXT NOT NULL,
        aplicada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await cliente.query('SELECT versao FROM schema_migracoes');
    const aplicadas = new Set(rows.map((linha) => linha.versao));
    for (const migracao of MIGRACOES) {
      if (aplicadas.has(migracao.versao)) continue;
      try {
        await cliente.query('BEGIN');
        await cliente.query(migracao.sql);
        await cliente.query('INSERT INTO schema_migracoes (versao, nome) VALUES ($1, $2)', [
          migracao.versao,
          migracao.nome
        ]);
        await cliente.query('COMMIT');
      } catch (erro) {
        await cliente.query('ROLLBACK');
        throw new Error(`migração ${migracao.versao} (${migracao.nome}) falhou: ${erro.message}`, { cause: erro });
      }
    }
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_MIGRACAO]).catch(() => {});
    cliente.release();
  }
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  await conexao().query('TRUNCATE historico_doacao, doacoes, usuarios RESTART IDENTITY');
}

export async function encerrar() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
