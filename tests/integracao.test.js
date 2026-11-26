import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, cadastrarELogar, dataFuturaEmDias, inserirVencida, prepararBanco, publicar } from './helpers.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;
let tokenOngA;

beforeEach(async () => {
  ({ tokenDoador, tokenOng: tokenOngA } = await prepararBanco());
});

afterAll(encerrar);

const comToken = (token) => ({ Authorization: `Bearer ${token}` });
const listar = (token, tipo) =>
  request(app)
    .get('/api/doacoes')
    .query(tipo ? { tipo } : {})
    .set(comToken(token));
const aceitar = (token, id) => request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(token));

describe('Cenário 1 — publicar → filtrar → aceitar → ONG cancela com observação → outra ONG aceita (H1 + H3 + H4)', () => {
  it('a doação circula entre duas ONGs sem nunca ficar com dois donos', async () => {
    const tokenOngB = await cadastrarELogar('ONG B', 'ongb@teste.com', 'ong');
    const idArroz = await publicar(tokenDoador, { tipo: 'Arroz', quantidade: '10' });
    const idFeijao = await publicar(tokenDoador, { tipo: 'Feijão', quantidade: '4' });
    const filtrada = await listar(tokenOngA, 'arr').expect(200);
    expect(filtrada.body.map((d) => d.id)).toEqual([idArroz]);
    await aceitar(tokenOngA, idArroz).expect(200);
    const listaB = await listar(tokenOngB).expect(200);
    expect(listaB.body.map((d) => d.id)).toEqual([idFeijao]);
    const segundaTentativa = await aceitar(tokenOngB, idArroz).expect(400);
    expect(segundaTentativa.body.erro).toBe('doação já foi aceita');
    await request(app)
      .post(`/api/doacoes/${idArroz}/cancelar`)
      .set(comToken(tokenOngA))
      .send({ observacao: 'Sem veículo para buscar hoje' })
      .expect(200);
    const historico = await request(app).get(`/api/doacoes/${idArroz}/historico`).set(comToken(tokenDoador));
    expect(historico.body).toMatchObject([
      { status_anterior: 'aceita', status_novo: 'disponivel', motivo: 'Sem veículo para buscar hoje' }
    ]);
    const coletasA = await request(app).get('/api/minhas-coletas').set(comToken(tokenOngA)).expect(200);
    expect(coletasA.body).toHaveLength(0);
    expect((await listar(tokenOngB, 'arroz')).body.map((d) => d.id)).toEqual([idArroz]);
    await aceitar(tokenOngB, idArroz).expect(200);
    const coletasB = await request(app).get('/api/minhas-coletas').set(comToken(tokenOngB)).expect(200);
    expect(coletasB.body.map((d) => d.id)).toEqual([idArroz]);
    const minhas = await request(app).get('/api/minhas-doacoes').set(comToken(tokenDoador)).expect(200);
    const status = Object.fromEntries(minhas.body.map((d) => [d.id, d.status]));
    expect(status).toEqual({ [idArroz]: 'aceita', [idFeijao]: 'disponivel' });
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [idArroz]);
    expect(rows).toEqual([{ status: 'aceita', ong: 'ONG B' }]);
  });
});

describe('Cenário 2 — doação aceita é cancelada pelo estabelecimento com motivo (H1 + H5c + autenticação)', () => {
  it('some das coletas da ONG, não pode ser aceita de novo e o histórico guarda o motivo', async () => {
    const id = await publicar(tokenDoador, { tipo: 'Pão', quantidade: '30' });
    await aceitar(tokenOngA, id).expect(200);

    const cancelamento = await request(app)
      .post(`/api/doacoes/${id}/cancelar-publicacao`)
      .set(comToken(tokenDoador))
      .send({ motivo: 'ONG não apareceu para retirar' })
      .expect(200);
    expect(cancelamento.body.status).toBe('cancelada');

    const coletas = await request(app).get('/api/minhas-coletas').set(comToken(tokenOngA)).expect(200);
    expect(coletas.body).toHaveLength(0);
    expect((await listar(tokenOngA)).body).toHaveLength(0);
    expect((await aceitar(tokenOngA, id).expect(400)).body.erro).toBe('doação cancelada pelo estabelecimento');

    const historico = await request(app).get(`/api/doacoes/${id}/historico`).set(comToken(tokenDoador)).expect(200);
    expect(historico.body).toMatchObject([
      { status_anterior: 'aceita', status_novo: 'cancelada', motivo: 'ONG não apareceu para retirar' }
    ]);

    const outroDoador = await cadastrarELogar('Padaria 2', 'padaria2@teste.com', 'doador');
    await request(app).get(`/api/doacoes/${id}/historico`).set(comToken(outroDoador)).expect(404);
  });
});

describe('Cenário 3 (erro) — entradas inválidas e acessos indevidos não alteram o banco', () => {
  it('validade impossível, perfil errado, falta de token e doação vencida são recusados', async () => {
    const antes = (await query('SELECT COUNT(*)::int AS n FROM doacoes')).rows[0].n;
    const dataInvalida = await request(app)
      .post('/api/doacoes')
      .set(comToken(tokenDoador))
      .send({ tipo: 'Leite', quantidade: '2', validade: '31/02/2099' })
      .expect(400);
    expect(dataInvalida.body).toEqual({ erro: 'validade deve ser uma data válida' });
    await request(app)
      .post('/api/doacoes')
      .set(comToken(tokenOngA))
      .send({ tipo: 'Leite', quantidade: '2', validade: dataFuturaEmDias(3) })
      .expect(403);
    await request(app).get('/api/doacoes').expect(401);

    expect((await query('SELECT COUNT(*)::int AS n FROM doacoes')).rows[0].n).toBe(antes);
    const idVencida = await inserirVencida();
    expect((await listar(tokenOngA)).body).toHaveLength(0);
    expect((await aceitar(tokenOngA, idVencida).expect(400)).body.erro).toBe('doação vencida');
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [idVencida]);
    expect(rows).toEqual([{ status: 'vencida', ong: null }]);
  });
});

describe('Regressão do merge — cada rota da API é registrada uma única vez', () => {
  it('não há método + caminho duplicado no roteador', () => {
    const rotas = app._router.stack
      .filter((camada) => camada.route)
      .flatMap((camada) => Object.keys(camada.route.methods).map((m) => `${m.toUpperCase()} ${camada.route.path}`));
    const duplicadas = rotas.filter((rota, i) => rotas.indexOf(rota) !== i);
    expect(duplicadas).toEqual([]);
    expect(rotas.length).toBeGreaterThanOrEqual(12);
  });
});
