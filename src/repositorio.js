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

export async function inserir({ tipo, quantidade, validade, doadorId = null }) {
  const { rows } = await query(
    `INSERT INTO doacoes (tipo, quantidade, validade, doador_id)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
    [tipo, quantidade, validade, doadorId]
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

export async function listarPublicadasPorDoador(doadorId) {
  const { rows } = await query('SELECT * FROM doacoes WHERE doador_id = ? ORDER BY id DESC', [doadorId]);
  return rows;
}

// H5c — o estabelecimento encerra a doação que publicou, com motivo.
// Um único comando: trava a linha, muda o status e grava o histórico juntos.
// Se a doação não for desse doador ou já estiver encerrada, nada muda e volta undefined.
export async function cancelarPeloDoador(id, doadorId, motivo) {
  const { rows } = await query(
    `WITH anterior AS (
       SELECT id, status FROM doacoes
       WHERE id = ? AND doador_id = ? AND status IN ('disponivel', 'aceita')
       FOR UPDATE
     ),
     atualizada AS (
       UPDATE doacoes d SET status = 'cancelada'
       FROM anterior a
       WHERE d.id = a.id
       RETURNING d.*, a.status AS status_anterior
     ),
     registro AS (
       INSERT INTO historico_doacao (doacao_id, status_anterior, status_novo, motivo)
       SELECT id, status_anterior, 'cancelada', ? FROM atualizada
     )
     SELECT * FROM atualizada`,
    [id, doadorId, motivo]
  );
  if (!rows[0]) return undefined;
  const doacao = { ...rows[0] };
  delete doacao.status_anterior;
  return doacao;
}

export async function listarHistorico(doacaoId) {
  const { rows } = await query(
    `SELECT status_anterior, status_novo, motivo, registrado_em
     FROM historico_doacao WHERE doacao_id = ? ORDER BY id`,
    [doacaoId]
  );
  return rows;
}
