// Camada de dados: contrato de query(), schema e restrições do PostgreSQL.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { encerrar, limparBanco, migrar, query } from '../src/db.js';
import * as repo from '../src/repositorio.js';

beforeEach(async () => {
  await migrar();
  await limparBanco();
});

const nova = { tipo: 'Arroz', quantidade: '1', validade: '01/01/2099' };

describe('query()', () => {
  it('converte cada ? em $n, preservando a ordem dos parâmetros', async () => {
    const { rows } = await query('SELECT ?::int - ?::int AS diferenca', [10, 4]);
    expect(rows[0].diferenca).toBe(6);
  });

  it('em consultas de escrita devolve rows vazio e a contagem de linhas alteradas', async () => {
    await repo.inserir(nova);
    await repo.inserir({ ...nova, tipo: 'Feijão' });
    const resultado = await query("UPDATE doacoes SET status = 'vencida' WHERE status = ?", ['disponivel']);
    expect(resultado.rows).toEqual([]);
    expect(resultado.alteradas).toBe(2);
  });

  it('devolve rows com as linhas do INSERT ... RETURNING', async () => {
    const { rows } = await query('INSERT INTO doacoes (tipo, quantidade, validade) VALUES (?, ?, ?) RETURNING id', [
      'Sopa',
      '2',
      '01/01/2099'
    ]);
    expect(rows[0].id).toEqual(expect.any(Number));
  });

  it('rejeita SQL inválido em vez de devolver vazio', async () => {
    await expect(query('SELEC 1')).rejects.toThrow();
  });

  it('rejeita tipo incompatível com a coluna (por isso doacoes.js valida o id antes)', async () => {
    await expect(query('SELECT * FROM doacoes WHERE id = ?', ['abc'])).rejects.toThrow(/integer/);
  });

  it('volta a funcionar depois de encerrar() e reabrir o pool', async () => {
    await encerrar();
    await encerrar(); // chamar duas vezes não pode falhar
    const { rows } = await query('SELECT 1 AS ok');
    expect(rows[0].ok).toBe(1);
  });
});

describe('migrar() e limparBanco()', () => {
  it('é idempotente: rodar de novo não falha nem apaga dados', async () => {
    await repo.inserir(nova);
    await migrar();
    await migrar();
    const { rows } = await query('SELECT count(*)::int AS total FROM doacoes');
    expect(rows[0].total).toBe(1);
  });

  it('cria as tabelas usuarios e doacoes', async () => {
    const { rows } = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('usuarios', 'doacoes') ORDER BY table_name"
    );
    expect(rows.map((r) => r.table_name)).toEqual(['doacoes', 'usuarios']);
  });

  it('limparBanco() apaga os dados e reinicia os ids em 1', async () => {
    await repo.inserir(nova);
    await limparBanco();
    const outra = await repo.inserir({ ...nova, tipo: 'Feijão' });
    expect(outra.id).toBe(1);
  });

  it('usa os valores padrão do schema: status disponivel, ong nula e criada_em preenchida', async () => {
    const doacao = await repo.inserir({ ...nova, tipo: 'Pão' });
    expect(doacao).toMatchObject({ status: 'disponivel', ong: null });
    expect(doacao.criada_em).toBeInstanceOf(Date);
  });
});

describe('restrições do schema (última barreira, atrás das validações da aplicação)', () => {
  const usuario = { nome: 'Teste', email: 'unico@teste.com', senha: 'x:y', perfil: 'ong' };

  it('e-mail é único', async () => {
    await repo.inserirUsuario(usuario);
    await expect(repo.inserirUsuario({ ...usuario, nome: 'Outro' })).rejects.toThrow(/unique|duplicate/i);
  });

  it('perfil só aceita doador ou ong', async () => {
    await expect(repo.inserirUsuario({ ...usuario, perfil: 'admin' })).rejects.toThrow(/check/i);
  });

  it.each(['tipo', 'quantidade', 'validade'])('doacoes.%s é obrigatório', async (coluna) => {
    await expect(repo.inserir({ ...nova, [coluna]: null })).rejects.toThrow(/not-null|null value/i);
  });
});

describe('repositório', () => {
  it('buscarUsuarioPorEmail devolve undefined quando não existe', async () => {
    expect(await repo.buscarUsuarioPorEmail('ninguem@teste.com')).toBeUndefined();
  });

  it('buscarPorId devolve undefined para id inexistente', async () => {
    expect(await repo.buscarPorId(12345)).toBeUndefined();
  });

  it('aceitar só altera doações disponíveis (segunda chamada devolve undefined)', async () => {
    const { id } = await repo.inserir(nova);
    expect((await repo.aceitar(id, 'ONG A')).status).toBe('aceita');
    expect(await repo.aceitar(id, 'ONG B')).toBeUndefined();
    expect((await repo.buscarPorId(id)).ong).toBe('ONG A');
  });

  it('cancelarAceite exige que a ONG seja a mesma que aceitou', async () => {
    const { id } = await repo.inserir(nova);
    await repo.aceitar(id, 'ONG A');
    expect(await repo.cancelarAceite(id, 'ONG B')).toBeUndefined();
    expect((await repo.cancelarAceite(id, 'ONG A')).status).toBe('disponivel');
  });

  it('marcarVencida não altera doação já aceita', async () => {
    const { id } = await repo.inserir(nova);
    await repo.aceitar(id, 'ONG A');
    await repo.marcarVencida(id);
    expect((await repo.buscarPorId(id)).status).toBe('aceita');
  });

  it('buscarAceitaPorOng devolve a coleta aceita da ONG', async () => {
    const { id } = await repo.inserir(nova);
    await repo.aceitar(id, 'ONG A');
    expect((await repo.buscarAceitaPorOng('ONG A')).id).toBe(id);
    expect(await repo.buscarAceitaPorOng('ONG B')).toBeUndefined();
  });
});

afterAll(async () => {
  await encerrar();
});
