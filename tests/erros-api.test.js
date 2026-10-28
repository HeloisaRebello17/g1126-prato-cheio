// Situações de erro da API: autenticação, permissões, validação de entrada e entradas hostis.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, dataFuturaEmDias, prepararBanco, publicar } from './helpers.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;
let tokenOng;

beforeEach(async () => {
  ({ tokenDoador, tokenOng } = await prepararBanco());
});

const comToken = (token) => ({ Authorization: `Bearer ${token}` });

describe('autenticação — token ausente ou inválido', () => {
  it.each([
    ['sem cabeçalho Authorization', {}],
    ['esquema diferente de Bearer', { Authorization: 'Basic abc123' }],
    ['Bearer sem token', { Authorization: 'Bearer ' }],
    ['token inexistente', { Authorization: 'Bearer token-que-nao-existe' }]
  ])('responde 401 em /api/me: %s', async (_descricao, cabecalhos) => {
    const res = await request(app).get('/api/me').set(cabecalhos);
    expect(res.status).toBe(401);
    expect(res.body.erro).toMatch(/autenticação/);
  });

  it.each([
    ['get', '/api/doacoes'],
    ['get', '/api/minhas-coletas'],
    ['post', '/api/doacoes'],
    ['post', '/api/doacoes/1/aceitar'],
    ['post', '/api/doacoes/1/cancelar']
  ])('protege %s %s', async (metodo, rota) => {
    const res = await request(app)[metodo](rota);
    expect(res.status).toBe(401);
  });

  it('devolve somente dados públicos do usuário em /api/me', async () => {
    const res = await request(app).get('/api/me').set(comToken(tokenOng));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(Number), nome: 'ONG', email: 'ong@teste.com', perfil: 'ong' });
    expect(res.body.senha).toBeUndefined();
  });
});

describe('autorização — perfil sem permissão', () => {
  it('doador não lista, aceita nem cancela doações', async () => {
    const id = await publicar(tokenDoador);
    const cabecalho = comToken(tokenDoador);
    expect((await request(app).get('/api/doacoes').set(cabecalho)).status).toBe(403);
    expect((await request(app).get('/api/minhas-coletas').set(cabecalho)).status).toBe(403);
    expect((await request(app).post(`/api/doacoes/${id}/aceitar`).set(cabecalho)).status).toBe(403);
    expect((await request(app).post(`/api/doacoes/${id}/cancelar`).set(cabecalho)).status).toBe(403);
  });

  it('ONG não publica doações', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .set(comToken(tokenOng))
      .send({ tipo: 'Arroz', quantidade: '5', validade: dataFuturaEmDias(3) });
    expect(res.status).toBe(403);
    const { rows } = await query('SELECT count(*)::int AS total FROM doacoes');
    expect(rows[0].total).toBe(0);
  });

  it('a recusa por perfil não altera o estado da doação', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenDoador)).expect(403);
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [id]);
    expect(rows[0]).toEqual({ status: 'disponivel', ong: null });
  });
});

describe('cadastro — validação de entrada', () => {
  const valido = { nome: 'Pessoa', email: 'pessoa@teste.com', senha: 'segura123', perfil: 'doador' };

  it.each([
    ['nome ausente', { ...valido, nome: undefined }, /obrigatórios/],
    ['nome só com espaços', { ...valido, nome: '   ' }, /obrigatórios/],
    ['nome que não é texto', { ...valido, nome: 42 }, /obrigatórios/],
    ['e-mail ausente', { ...valido, email: undefined }, /obrigatórios/],
    ['senha ausente', { ...valido, senha: undefined }, /obrigatórios/],
    ['perfil ausente', { ...valido, perfil: undefined }, /obrigatórios/],
    ['senha com menos de 6 caracteres', { ...valido, senha: '12345' }, /6 caracteres/],
    ['perfil desconhecido', { ...valido, perfil: 'admin' }, /doador ou ong/]
  ])('recusa com 400: %s', async (_descricao, corpo, mensagem) => {
    const res = await request(app).post('/api/cadastro').send(corpo);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(mensagem);
    const { rows } = await query('SELECT count(*)::int AS total FROM usuarios WHERE email = ?', [valido.email]);
    expect(rows[0].total).toBe(0);
  });

  it('recusa corpo vazio e corpo que não é objeto', async () => {
    expect((await request(app).post('/api/cadastro')).status).toBe(400);
    expect((await request(app).post('/api/cadastro').send([1, 2])).status).toBe(400);
  });

  it('trata e-mail sem diferenciar maiúsculas e minúsculas', async () => {
    await request(app)
      .post('/api/cadastro')
      .send({ ...valido, email: 'Maiuscula@Teste.com' })
      .expect(201);
    const repetido = await request(app)
      .post('/api/cadastro')
      .send({ ...valido, email: 'maiuscula@teste.COM' });
    expect(repetido.status).toBe(400);
    expect(repetido.body.erro).toMatch(/já cadastrado/);
  });

  it('nunca grava a senha em texto puro', async () => {
    await request(app).post('/api/cadastro').send(valido).expect(201);
    const { rows } = await query('SELECT senha FROM usuarios WHERE email = ?', [valido.email]);
    expect(rows[0].senha).not.toContain(valido.senha);
    expect(rows[0].senha).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });
});

describe('login — validação de entrada', () => {
  it.each([
    ['corpo vazio', undefined, /obrigatórios/],
    ['senha ausente', { email: 'doador@teste.com' }, /obrigatórios/],
    ['e-mail fora do formato .com', { email: 'doador@teste.org', senha: 'segura123' }, /\.com/],
    ['e-mail inexistente', { email: 'ninguem@teste.com', senha: 'segura123' }, /inválidos/],
    ['senha incorreta', { email: 'doador@teste.com', senha: 'errada' }, /inválidos/]
  ])('recusa com 401: %s', async (_descricao, corpo, mensagem) => {
    const res = await request(app).post('/api/login').send(corpo);
    expect(res.status).toBe(401);
    expect(res.body.erro).toMatch(mensagem);
    expect(res.body.token).toBeUndefined();
  });

  it('usa a mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem)', async () => {
    const a = await request(app).post('/api/login').send({ email: 'ninguem@teste.com', senha: 'segura123' });
    const b = await request(app).post('/api/login').send({ email: 'doador@teste.com', senha: 'errada' });
    expect(a.body.erro).toBe(b.body.erro);
  });

  it('aceita o e-mail com espaços e maiúsculas', async () => {
    const res = await request(app).post('/api/login').send({ email: '  DOADOR@teste.com ', senha: 'segura123' });
    expect(res.status).toBe(200);
  });
});

describe('entradas hostis e rotas inexistentes', () => {
  it('responde 400 a JSON malformado, sem criar registros', async () => {
    const res = await request(app).post('/api/cadastro').set('Content-Type', 'application/json').send('{"nome":');
    expect(res.status).toBe(400);
    const { rows } = await query('SELECT count(*)::int AS total FROM usuarios');
    expect(rows[0].total).toBe(2); // só os dois usuários criados por prepararBanco()
  });

  it('responde 404 a uma rota inexistente', async () => {
    expect((await request(app).get('/api/nao-existe')).status).toBe(404);
  });

  it('trata texto de injeção de SQL no filtro como dado, não como comando', async () => {
    await publicar(tokenDoador, { tipo: 'Arroz' });
    const ataque = "x'; DROP TABLE doacoes; --";
    const res = await request(app).get('/api/doacoes').query({ tipo: ataque }).set(comToken(tokenOng));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    const { rows } = await query('SELECT count(*)::int AS total FROM doacoes');
    expect(rows[0].total).toBe(1);
  });

  it('trata texto de injeção de SQL nos campos da doação como dado', async () => {
    const tipo = "Sopa'); DELETE FROM usuarios; --";
    const res = await request(app)
      .post('/api/doacoes')
      .set(comToken(tokenDoador))
      .send({ tipo, quantidade: '2', validade: dataFuturaEmDias(2) });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe(tipo);
    const { rows } = await query('SELECT count(*)::int AS total FROM usuarios');
    expect(rows[0].total).toBe(2);
  });

  it('ignora parâmetro de filtro repetido em vez de quebrar', async () => {
    await publicar(tokenDoador);
    const res = await request(app).get('/api/doacoes?tipo=a&tipo=b').set(comToken(tokenOng));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

afterAll(async () => {
  await encerrar();
});
