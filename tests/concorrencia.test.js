// RNF2 — consistência no aceite: o banco, e não a aplicação, decide quem ganha a disputa.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, cadastrarELogar, prepararBanco, publicar } from './helpers.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;

beforeEach(async () => {
  ({ tokenDoador } = await prepararBanco());
});

const comToken = (token) => ({ Authorization: `Bearer ${token}` });

describe('aceite concorrente', () => {
  it('com 10 ONGs disputando a mesma doação, exatamente uma vence', async () => {
    const id = await publicar(tokenDoador);
    const tokens = await Promise.all(
      Array.from({ length: 10 }, (_, i) => cadastrarELogar(`ONG ${i}`, `ong${i}@disputa.com`, 'ong'))
    );

    const respostas = await Promise.all(
      tokens.map((token) => request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(token)))
    );

    const vencedoras = respostas.filter((r) => r.status === 200);
    const recusadas = respostas.filter((r) => r.status === 400);
    expect(vencedoras).toHaveLength(1);
    expect(recusadas).toHaveLength(9);
    recusadas.forEach((r) => expect(r.body.erro).toMatch(/já foi aceita/));

    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [id]);
    expect(rows[0].status).toBe('aceita');
    expect(rows[0].ong).toBe(vencedoras[0].body.ong);
  });

  it('doações diferentes podem ser aceitas em paralelo sem interferência', async () => {
    const ids = await Promise.all([publicar(tokenDoador), publicar(tokenDoador), publicar(tokenDoador)]);
    const tokens = await Promise.all(ids.map((_, i) => cadastrarELogar(`ONG ${i}`, `ong${i}@paralelo.com`, 'ong')));

    const respostas = await Promise.all(
      ids.map((id, i) => request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokens[i])))
    );

    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200]);
    const { rows } = await query("SELECT count(*)::int AS total FROM doacoes WHERE status = 'aceita'");
    expect(rows[0].total).toBe(3);
  });

  it('aceite e cancelamento simultâneos terminam num estado consistente', async () => {
    const id = await publicar(tokenDoador);
    const tokenA = await cadastrarELogar('ONG A', 'a@corrida.com', 'ong');
    const tokenB = await cadastrarELogar('ONG B', 'b@corrida.com', 'ong');
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenA)).expect(200);

    // A cancela enquanto B tenta aceitar: ou B perde (400), ou B vence depois do cancelamento (200).
    const [cancelamento, aceiteB] = await Promise.all([
      request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenA)),
      request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenB))
    ]);

    expect(cancelamento.status).toBe(200);
    expect([200, 400]).toContain(aceiteB.status);
    const { rows } = await query('SELECT status, ong FROM doacoes WHERE id = ?', [id]);
    if (aceiteB.status === 200) expect(rows[0]).toEqual({ status: 'aceita', ong: 'ONG B' });
    else expect(rows[0]).toEqual({ status: 'disponivel', ong: null });
  });
});

describe('cadastro concorrente', () => {
  it('o mesmo e-mail em requisições simultâneas gera uma única conta', async () => {
    const corpo = { nome: 'Duplicada', email: 'duplicada@teste.com', senha: 'segura123', perfil: 'ong' };
    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/api/cadastro').send(corpo))
    );

    expect(respostas.filter((r) => r.status === 201)).toHaveLength(1);
    const { rows } = await query('SELECT count(*)::int AS total FROM usuarios WHERE email = ?', [corpo.email]);
    expect(rows[0].total).toBe(1);
  });
});

afterAll(async () => {
  await encerrar();
});
