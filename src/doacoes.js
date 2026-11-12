// Regras de negócio das doações.
import * as repo from './repositorio.js';

// Situações possíveis de uma doação (mesmos valores gravados na coluna `status`).
export const STATUS = Object.freeze({
  DISPONIVEL: 'disponivel',
  ACEITA: 'aceita',
  VENCIDA: 'vencida',
  CANCELADA: 'cancelada'
});

function paraData(validade) {
  const [dia, mes, ano] = validade.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

function inicioDeHoje() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

// id vem da URL; um valor que não é inteiro (ex.: "abc") faria o PostgreSQL
// rejeitar a consulta com erro de tipo — para a API é só uma doação inexistente.
function idValido(id) {
  return /^\d{1,10}$/.test(String(id)) && Number(id) <= 2147483647;
}

// O nome da ONG é obrigatório em várias regras; devolve o nome já sem espaços nas pontas.
function exigirOng(ong) {
  if (typeof ong !== 'string' || !ong.trim()) throw new Error('ONG é obrigatória');
  return ong.trim();
}

// A doação vale até o fim do dia da validade; vence a partir do dia seguinte.
function estaVencida(doacao) {
  return paraData(doacao.validade) < inicioDeHoje();
}

function validarValidade(validade) {
  if (typeof validade !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(validade)) {
    throw new Error('validade deve estar no formato dd/mm/aaaa');
  }

  const [dia, mes, ano] = validade.split('/').map(Number);
  const dataValidade = paraData(validade);

  if (dataValidade.getFullYear() !== ano || dataValidade.getMonth() !== mes - 1 || dataValidade.getDate() !== dia) {
    throw new Error('validade deve ser uma data válida');
  }

  if (dataValidade < inicioDeHoje()) {
    throw new Error('validade não pode ser anterior à data de hoje');
  }
}

// História zero — "um doador publica uma doação".
// Critério: tipo, quantidade e validade são obrigatórios.
export async function criarDoacao({ tipo, quantidade, validade } = {}, doadorId = null) {
  if (typeof tipo !== 'string' || !tipo.trim() || typeof validade !== 'string' || !validade.trim()) {
    throw new Error('tipo, quantidade e validade são obrigatórios');
  }
  if (
    typeof quantidade !== 'string' ||
    !/^\d+(?:[.,]\d+)?$/.test(quantidade.trim()) ||
    Number(quantidade.replace(',', '.')) <= 0
  ) {
    throw new Error('quantidade deve ser um número positivo');
  }

  validarValidade(validade);

  return repo.inserir({ tipo: tipo.trim(), quantidade: quantidade.trim(), validade, doadorId });
}

// História zero — "uma ONG vê as doações disponíveis".
// H5a — "doação vencida sai da lista": ao listar, as que passaram da validade
// são marcadas como 'vencida' e não aparecem mais para as ONGs.
export async function listarDisponiveis(tipo) {
  const disponiveis = await repo.listarDisponiveis(tipo);
  const validas = [];
  for (const doacao of disponiveis) {
    if (estaVencida(doacao)) await repo.marcarVencida(doacao.id);
    else validas.push(doacao);
  }
  return validas;
}

export async function listarAceitas(ong) {
  return repo.listarAceitasPorOng(exigirOng(ong));
}

// História zero — "uma ONG aceita uma doação".
// Regra do caso: uma doação aceita não fica disponível para outra ONG.
// H5a: uma doação vencida não pode ser aceita.
export async function aceitar(id, ong) {
  const nomeOng = exigirOng(ong);
  if (!idValido(id)) throw new Error('doação não encontrada');
  const doacao = await repo.buscarPorId(id);
  if (!doacao) throw new Error('doação não encontrada');
  if (doacao.status === STATUS.VENCIDA) throw new Error('doação vencida');
  if (doacao.status === STATUS.CANCELADA) throw new Error('doação cancelada pelo estabelecimento');
  if (doacao.status === STATUS.DISPONIVEL && estaVencida(doacao)) {
    await repo.marcarVencida(doacao.id);
    throw new Error('doação vencida');
  }
  if (doacao.status !== STATUS.DISPONIVEL) {
    throw new Error('doação já foi aceita');
  }

  const aceita = await repo.aceitar(id, nomeOng);
  if (!aceita) throw new Error('doação já foi aceita');
  return aceita;
}

export async function cancelar(id, ong) {
  const nomeOng = exigirOng(ong);
  if (!idValido(id)) throw new Error('coleta não encontrada para esta ONG');
  const cancelada = await repo.cancelarAceite(id, nomeOng);
  if (!cancelada) throw new Error('coleta não encontrada para esta ONG');
  return cancelada;
}

export const MOTIVO_MAXIMO = 500;

export async function listarPublicadas(doadorId) {
  return repo.listarPublicadasPorDoador(doadorId);
}

// H5c — "estabelecimento cancela manualmente uma doação, registrando o motivo".
// Critério: o motivo é obrigatório e fica no histórico; a doação sai da lista das ONGs
// (e das coletas da ONG, se já tinha sido aceita). Só quem publicou pode cancelar,
// e só enquanto ela está disponível ou aceita.
export async function cancelarPeloDoador(id, doadorId, motivo) {
  if (typeof motivo !== 'string' || !motivo.trim()) throw new Error('motivo do cancelamento é obrigatório');
  if (motivo.trim().length > MOTIVO_MAXIMO) {
    throw new Error(`motivo deve ter no máximo ${MOTIVO_MAXIMO} caracteres`);
  }
  if (!idValido(id)) throw new Error('doação não encontrada');

  const cancelada = await repo.cancelarPeloDoador(id, doadorId, motivo.trim());
  if (cancelada) return cancelada;

  // Nada mudou: descobre o porquê só para dar uma mensagem útil.
  const doacao = await repo.buscarPorId(id);
  if (!doacao || doacao.doador_id !== doadorId) throw new Error('doação não encontrada');
  throw new Error(`doação já está ${doacao.status} e não pode ser cancelada`);
}

export async function historico(id, doadorId) {
  if (!idValido(id)) throw new Error('doação não encontrada');
  const doacao = await repo.buscarPorId(id);
  if (!doacao || doacao.doador_id !== doadorId) throw new Error('doação não encontrada');
  return repo.listarHistorico(doacao.id);
}
