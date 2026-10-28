// Regras de negócio das doações: valores de borda, ciclo de vida e isolamento entre ONGs.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, cadastrarELogar, dataFuturaEmDias, inserirVencida, prepararBanco, publicar } from './helpers.js';
import * as doacoes from '../src/doacoes.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;
let tokenOng;

beforeEach(async () => {
  ({ tokenDoador, tokenOng } = await prepararBanco());
});

const comToken = (token) => ({ Authorization: `Bearer ${token}` });
const publicarCom = (corpo) => request(app).post('/api/doacoes').set(comToken(tokenDoador)).send(corpo);

describe('publicar — validade', () => {
  it.each([
    ['formato ISO', '2099-12-31'],
    ['dia sem zero à esquerda', '1/1/2099'],
    ['texto qualquer', 'amanhã'],
    ['vazio', ''],
    ['número em vez de texto', 20991231]
  ])('recusa formato inválido: %s', async (_descricao, validade) => {
    const res = await publicarCom({ tipo: 'Arroz', quantidade: '5', validade });
    expect(res.status).toBe(400);
  });

  it.each([
    ['31/02/2099', 'dia 31 de fevereiro'],
    ['00/10/2099', 'dia zero'],
    ['32/01/2099', 'dia 32'],
    ['15/13/2099', 'mês 13']
  ])('recusa data inexistente no calendário: %s (%s)', async (validade) => {
    const res = await publicarCom({ tipo: 'Arroz', quantidade: '5', validade });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/data válida/);
  });

  it('aceita 29/02 em ano bissexto e recusa em ano comum', async () => {
    expect((await publicarCom({ tipo: 'Arroz', quantidade: '5', validade: '29/02/2096' })).status).toBe(201);
    expect((await publicarCom({ tipo: 'Arroz', quantidade: '5', validade: '29/02/2097' })).status).toBe(400);
  });

  it('não grava nada quando a validação falha', async () => {
    await publicarCom({ tipo: 'Arroz', quantidade: '0', validade: dataFuturaEmDias(2) });
    await publicarCom({ tipo: 'Arroz', quantidade: '5', validade: 'xx' });
    const { rows } = await query('SELECT count(*)::int AS total FROM doacoes');
    expect(rows[0].total).toBe(0);
  });
});

describe('publicar — tipo e quantidade', () => {
  it.each(['1,5', '2.5', '10', ' 7 '])('aceita quantidade numérica: "%s"', async (quantidade) => {
    const res = await publicarCom({ tipo: 'Feijão', quantidade, validade: dataFuturaEmDias(3) });
    expect(res.status).toBe(201);
    expect(res.body.quantidade).toBe(quantidade.trim());
  });

  it.each([
    ['número', 10],
    ['booleano', true],
    ['objeto', { valor: 10 }],
    ['nulo', null]
  ])('recusa quantidade que não é texto (%s)', async (_descricao, quantidade) => {
    const res = await publicarCom({ tipo: 'Arroz', quantidade, validade: dataFuturaEmDias(3) });
    expect(res.status).toBe(400);
  });

  it.each([
    ['número', 7],
    ['lista', ['Arroz']],
    ['nulo', null]
  ])('recusa tipo que não é texto (%s)', async (_descricao, tipo) => {
    const res = await publicarCom({ tipo, quantidade: '5', validade: dataFuturaEmDias(3) });
    expect(res.status).toBe(400);
  });

  it('remove espaços nas pontas de tipo e quantidade, e devolve status disponivel', async () => {
    const res = await publicarCom({ tipo: '  Pão  ', quantidade: ' 12 ', validade: dataFuturaEmDias(1) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'Pão', quantidade: '12', status: 'disponivel', ong: null });
  });
});

describe('aceitar — ids inválidos e inexistentes', () => {
  it.each([
    ['inexistente', '99999'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['acima de int4', '2147483648'],
    ['texto', 'abc']
  ])('responde "não encontrada" para id %s', async (_descricao, id) => {
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });

  it('recusa a segunda tentativa da mesma ONG sobre a mesma doação', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi aceita/);
  });

  it('usa o nome da ONG autenticada, ignorando o nome enviado no corpo', async () => {
    const id = await publicar(tokenDoador);
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set(comToken(tokenOng))
      .send({ ong: 'Impostora' });
    expect(res.body.ong).toBe('ONG');
  });
});

describe('aceitar — doação vencida (expiração sob demanda)', () => {
  it('marca como vencida ao tentar aceitar uma doação disponível fora da validade', async () => {
    const id = await inserirVencida();
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/vencida/);
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [id]);
    expect(rows[0]).toEqual({ status: 'vencida', ong: null });
  });

  it('continua recusando uma doação que já estava marcada como vencida', async () => {
    const id = await inserirVencida();
    await request(app).get('/api/doacoes').set(comToken(tokenOng)); // a listagem marca como vencida
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/vencida/);
  });

  it('lista só as válidas quando há vencidas e válidas juntas', async () => {
    await inserirVencida();
    await publicar(tokenDoador, { tipo: 'Leite' });
    const res = await request(app).get('/api/doacoes').set(comToken(tokenOng));
    expect(res.body.map((d) => d.tipo)).toEqual(['Leite']);
  });
});

describe('cancelar — casos de erro e ciclo completo', () => {
  it('recusa cancelar uma doação que ninguém aceitou', async () => {
    const id = await publicar(tokenDoador);
    const res = await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });

  it.each(['abc', '-5', '99999', '2147483648'])('recusa cancelar id inválido ou inexistente: %s', async (id) => {
    const res = await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });

  it('recusa cancelar duas vezes a mesma coleta', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng)).expect(200);
    const res = await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng));
    expect(res.status).toBe(400);
  });

  it('depois do cancelamento, outra ONG consegue aceitar a mesma doação', async () => {
    const id = await publicar(tokenDoador);
    const tokenOutra = await cadastrarELogar('ONG Dois', 'dois@teste.com', 'ong');
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng)).expect(200);
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOutra));
    expect(res.status).toBe(200);
    expect(res.body.ong).toBe('ONG Dois');
  });

  it('a doação cancelada limpa o nome da ONG no banco', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng)).expect(200);
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [id]);
    expect(rows[0]).toEqual({ status: 'disponivel', ong: null });
  });
});

describe('minhas coletas — isolamento entre ONGs', () => {
  it('cada ONG vê somente as coletas que aceitou', async () => {
    const tokenOutra = await cadastrarELogar('ONG Dois', 'dois@teste.com', 'ong');
    const a = await publicar(tokenDoador);
    const b = await publicar(tokenDoador, { tipo: 'Leite' });
    await request(app).post(`/api/doacoes/${a}/aceitar`).set(comToken(tokenOng)).expect(200);
    await request(app).post(`/api/doacoes/${b}/aceitar`).set(comToken(tokenOutra)).expect(200);

    const minhas = await request(app).get('/api/minhas-coletas').set(comToken(tokenOng));
    const outras = await request(app).get('/api/minhas-coletas').set(comToken(tokenOutra));
    expect(minhas.body.map((d) => d.id)).toEqual([a]);
    expect(outras.body.map((d) => d.id)).toEqual([b]);
  });

  it('devolve lista vazia quando a ONG não aceitou nada', async () => {
    const res = await request(app).get('/api/minhas-coletas').set(comToken(tokenOng));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('listagem — filtro por tipo', () => {
  it('ignora maiúsculas, minúsculas e espaços ao redor do termo', async () => {
    await publicar(tokenDoador, { tipo: 'Arroz Integral' });
    const res = await request(app).get('/api/doacoes').query({ tipo: '  ARROZ ' }).set(comToken(tokenOng));
    expect(res.body).toHaveLength(1);
  });

  it('devolve lista vazia, e não erro, quando nenhum tipo corresponde', async () => {
    await publicar(tokenDoador, { tipo: 'Arroz' });
    const res = await request(app).get('/api/doacoes').query({ tipo: 'inexistente' }).set(comToken(tokenOng));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('mantém a ordem de publicação', async () => {
    for (const tipo of ['Primeira', 'Segunda', 'Terceira']) await publicar(tokenDoador, { tipo });
    const res = await request(app).get('/api/doacoes').set(comToken(tokenOng));
    expect(res.body.map((d) => d.tipo)).toEqual(['Primeira', 'Segunda', 'Terceira']);
  });
});

describe('módulo de regras (sem HTTP)', () => {
  it('listarAceitas recusa nome de ONG vazio ou que não é texto', async () => {
    await expect(doacoes.listarAceitas('   ')).rejects.toThrow('ONG é obrigatória');
    await expect(doacoes.listarAceitas(undefined)).rejects.toThrow('ONG é obrigatória');
  });

  it('cancelar e aceitar recusam ONG vazia antes de consultar o banco', async () => {
    await expect(doacoes.cancelar(1, '')).rejects.toThrow('ONG é obrigatória');
    await expect(doacoes.aceitar(1, null)).rejects.toThrow('ONG é obrigatória');
  });

  it('criarDoacao devolve o registro completo com id gerado e criada_em', async () => {
    const doacao = await doacoes.criarDoacao({ tipo: 'Sopa', quantidade: '3', validade: dataFuturaEmDias(1) });
    expect(doacao).toMatchObject({ id: expect.any(Number), tipo: 'Sopa', status: 'disponivel' });
    expect(new Date(doacao.criada_em).getTime()).not.toBeNaN();
  });
});

afterAll(async () => {
  await encerrar();
});
