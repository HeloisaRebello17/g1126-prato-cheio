// Regras de negócio das doações.
import * as repo from './repositorio.js';

function paraData(validade) {
  const [dia, mes, ano] = validade.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

function inicioDeHoje() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
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

  if (
    dataValidade.getFullYear() !== ano ||
    dataValidade.getMonth() !== mes - 1 ||
    dataValidade.getDate() !== dia
  ) {
    throw new Error('validade deve ser uma data válida');
  }

  if (dataValidade < inicioDeHoje()) {
    throw new Error('validade não pode ser anterior à data de hoje');
  }
}

// História zero — "um doador publica uma doação".
// Critério: tipo, quantidade e validade são obrigatórios.
export async function criarDoacao({ tipo, quantidade, validade }) {
  if (!tipo || !quantidade || !validade) {
    throw new Error('tipo, quantidade e validade são obrigatórios');
  }

  validarValidade(validade);

  return repo.inserir({ tipo, quantidade, validade });
}

// História zero — "uma ONG vê as doações disponíveis".
// H5a — "doação vencida sai da lista": ao listar, as que passaram da validade
// são marcadas como 'vencida' e não aparecem mais para as ONGs.
export async function listarDisponiveis() {
  const disponiveis = await repo.listarDisponiveis();
  const validas = [];
  for (const doacao of disponiveis) {
    if (estaVencida(doacao)) await repo.marcarVencida(doacao.id);
    else validas.push(doacao);
  }
  return validas;
}

// História zero — "uma ONG aceita uma doação".
// Regra do caso: uma doação aceita não fica disponível para outra ONG.
// H5a: uma doação vencida não pode ser aceita.
export async function aceitar(id, ong) {
  const doacao = await repo.buscarPorId(id);
  if (!doacao) throw new Error('doação não encontrada');
  if (doacao.status === 'vencida') throw new Error('doação vencida');
  if (doacao.status === 'disponivel' && estaVencida(doacao)) {
    await repo.marcarVencida(doacao.id);
    throw new Error('doação vencida');
  }
  if (doacao.status !== 'disponivel') {
    throw new Error('doação já foi aceita');
  }

  const aceita = await repo.aceitar(id, ong);
  if (!aceita) throw new Error('doação já foi aceita');
  return aceita;
}
