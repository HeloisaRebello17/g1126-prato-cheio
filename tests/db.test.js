// Camada de dados: contrato de query(), schema e restrições do PostgreSQL.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MIGRACOES, encerrar, limparBanco, migrar, query } from '../src/db.js';
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

  it('registra cada migração aplicada, em ordem, em schema_migracoes', async () => {
    const { rows } = await query('SELECT versao FROM schema_migracoes ORDER BY versao');
    expect(rows.map((r) => r.versao)).toEqual(MIGRACOES.map((m) => m.versao));
  });

  it('as versões das migrações são únicas e crescentes', () => {
    const versoes = MIGRACOES.map((m) => m.versao);
    expect(versoes).toEqual([...new Set(versoes)].sort((a, b) => a - b));
  });

  it('migração 2: doacoes.doador_id referencia usuarios e historico_doacao existe', async () => {
    await expect(
      query('INSERT INTO doacoes (tipo, quantidade, validade, doador_id) VALUES (?, ?, ?, ?)', [
        'Arroz',
        '1',
        '01/01/2099',
        999
      ])
    ).rejects.toThrow(/foreign key/i);
    const { rows } = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'historico_doacao' ORDER BY ordinal_position"
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      'id',
      'doacao_id',
      'status_anterior',
      'status_novo',
      'motivo',
      'registrado_em'
    ]);
  });

  it('atualiza um banco criado antes do controle de versões sem perder dados', async () => {
    // Simula o banco que já existia na main: tabelas da versão 1, sem doador_id, sem histórico.
    await query('DROP TABLE schema_migracoes, historico_doacao');
    await query('ALTER TABLE doacoes DROP COLUMN doador_id');
    await query('INSERT INTO doacoes (tipo, quantidade, validade) VALUES (?, ?, ?)', ['Arroz', '1', '01/01/2099']);
    await migrar();
    const { rows } = await query('SELECT doador_id FROM doacoes');
    expect(rows).toEqual([{ doador_id: null }]);
    const versoes = await query('SELECT count(*)::int AS total FROM schema_migracoes');
    expect(versoes.rows[0].total).toBe(MIGRACOES.length);
  });

  it('desfaz a migração que falha e não a marca como aplicada', async () => {
    MIGRACOES.push({ versao: 999, nome: 'quebrada', sql: 'CREATE TABLE tabela_parcial (id INT); SELEC 1' });
    try {
      await expect(migrar()).rejects.toThrow(/migração 999 \(quebrada\) falhou/);
    } finally {
      MIGRACOES.pop();
    }
    const tabela = await query("SELECT to_regclass('tabela_parcial') AS existe");
    expect(tabela.rows[0].existe).toBeNull();
    const registro = await query('SELECT * FROM schema_migracoes WHERE versao = 999');
    expect(registro.rows).toHaveLength(0);
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
});

afterAll(async () => {
  await encerrar();
});
