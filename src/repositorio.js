// Camada de dados do Prato Cheio — acesso ao banco.
// A conexão e o schema já estão prontos em src/db.js.
//
// Marcador de parâmetro é `?` (convertido para $n no db.js; evita injeção):
//   const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
import { query } from './db.js';

export async function inserirUsuario({ nome, email, senha, perfil }) {
  const { rows } = await query(
    'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?) RETURNING id, nome, email, perfil',
    [nome, email, senha, perfil]
  );
  return rows[0];
}

export async function buscarUsuarioPorEmail(email) {
  const { rows } = await query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return rows[0];
}

export async function inserir({ tipo, quantidade, validade }) {
  const { rows } = await query(
    `INSERT INTO doacoes (tipo, quantidade, validade)
     VALUES (?, ?, ?)
     RETURNING *`,
    [tipo, quantidade, validade]
  );
  return rows[0];
}

export async function listarDisponiveis(tipo) {
  const filtro = typeof tipo === 'string' && tipo.trim() ? ' AND lower(tipo) LIKE lower(?)' : '';
  const valores = filtro ? [`%${tipo.trim()}%`] : [];
  const { rows } = await query(`SELECT * FROM doacoes WHERE status = 'disponivel'${filtro} ORDER BY id`, valores);
  return rows;
}

export async function listarAceitasPorOng(ong) {
  const { rows } = await query("SELECT * FROM doacoes WHERE status = 'aceita' AND ong = ? ORDER BY id", [ong]);
  return rows;
}

export async function buscarPorId(id) {
  const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
  return rows[0];
}

export async function aceitar(id, ong) {
  const { rows } = await query(
    `UPDATE doacoes
     SET status = 'aceita', ong = ?
     WHERE id = ? AND status = 'disponivel'
     RETURNING *`,
    [ong, id]
  );
  return rows[0];
}

export async function marcarVencida(id) {
  await query(
    `UPDATE doacoes
     SET status = 'vencida'
     WHERE id = ? AND status = 'disponivel'`,
    [id]
  );
}

export async function buscarAceitaPorOng(ong) {
  const { rows } = await query(
    `SELECT * FROM doacoes
     WHERE ong = ? AND status = 'aceita'
     LIMIT 1`,
    [ong]
  );

  return rows[0];
}

export async function cancelarAceite(id, ong) {
  const { rows } = await query(
    `UPDATE doacoes
     SET status = 'disponivel', ong = NULL
     WHERE id = ? AND status = 'aceita' AND ong = ?
     RETURNING *`,
    [id, ong]
  );
  return rows[0];
}
