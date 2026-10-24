import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, cadastrarELogar, publicar, prepararBanco } from './helpers.js';
import { encerrar } from '../src/db.js';

let tokenDoador;
let tokenOng;

beforeEach(async () => {
  ({ tokenDoador, tokenOng } = await prepararBanco());
});

describe('aceitar uma doação', () => {
  it('marca a doação como aceita pela ONG', async () => {
    const id = await publicar(tokenDoador);
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set('Authorization', `Bearer ${tokenOng}`)
      .send({ ong: 'ONG Esperança' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aceita');
    expect(res.body.ong).toBe('ONG');
  });

  it('remove a doação da lista depois de aceita', async () => {
    const id = await publicar(tokenDoador);
    await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set('Authorization', `Bearer ${tokenOng}`)
      .send({ ong: 'ONG A' });
    const res = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(res.body).toHaveLength(0);
  });

  it('recusa aceitar uma doação já aceita', async () => {
    const id = await publicar(tokenDoador);
    await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set('Authorization', `Bearer ${tokenOng}`)
      .send({ ong: 'ONG A' });
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set('Authorization', `Bearer ${tokenOng}`)
      .send({ ong: 'ONG B' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi aceita/);
  });

  it('aceita uma única ONG quando duas tentam simultaneamente', async () => {
    const id = await publicar(tokenDoador);
    const tokenOutraOng = await cadastrarELogar('Outra ONG', 'outra-concorrencia@teste.com', 'ong');
    const respostas = await Promise.all([
      request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOng}`).send({}),
      request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOutraOng}`).send({})
    ]);
    expect(respostas.filter((resposta) => resposta.status === 200)).toHaveLength(1);
    expect(respostas.filter((resposta) => resposta.status === 400)).toHaveLength(1);
    const disponiveis = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(disponiveis.body).toHaveLength(0);
  });
});

describe('cancelar coleta', () => {
  it('cancela a coleta e devolve a doação para a lista', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOng}`).expect(200);
    const minhas = await request(app).get('/api/minhas-coletas').set('Authorization', `Bearer ${tokenOng}`);
    expect(minhas.body).toHaveLength(1);
    const cancelamento = await request(app)
      .post(`/api/doacoes/${id}/cancelar`)
      .set('Authorization', `Bearer ${tokenOng}`);
    expect(cancelamento.status).toBe(200);
    expect(cancelamento.body.status).toBe('disponivel');
    const disponiveis = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(disponiveis.body).toHaveLength(1);
  });

  it('não permite cancelar coleta de outra ONG', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOng}`).expect(200);
    const outraOng = await cadastrarELogar('Outra ONG', 'outra@teste.com', 'ong');
    const res = await request(app).post(`/api/doacoes/${id}/cancelar`).set('Authorization', `Bearer ${outraOng}`);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });
});

afterAll(async () => {
  await encerrar();
});
