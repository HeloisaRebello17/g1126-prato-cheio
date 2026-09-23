// Regras de negócio das doações.
import * as repo from './repositorio.js';

function validarValidade(validade) {
  if (typeof validade !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(validade)) {
    throw new Error('validade deve estar no formato dd/mm/aaaa');
  }

  const [dia, mes, ano] = validade.split('/').map(Number);
  const dataValidade = new Date(ano, mes - 1, dia);

  if (
    dataValidade.getFullYear() !== ano ||
    dataValidade.getMonth() !== mes - 1 ||
    dataValidade.getDate() !== dia
  ) {
    throw new Error('validade deve ser uma data válida');
  }

  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (dataValidade < inicioHoje) {
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
export async function listarDisponiveis() {
  return repo.listarDisponiveis();
}

// História zero — "uma ONG aceita uma doação".
// Regra do caso: uma doação aceita não fica disponível para outra ONG.
export async function aceitar(id, ong) {
  const doacao = await repo.buscarPorId(id);
  if (!doacao) throw new Error('doação não encontrada');
  if (doacao.status !== 'disponivel') {
    throw new Error('doação já foi aceita');
  }

  const aceita = await repo.aceitar(id, ong);
  if (!aceita) throw new Error('doação já foi aceita');
  return aceita;
}
