import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, dataFuturaEmDias, inserirVencida, prepararBanco } from './helpers.js';
import * as doacoes from '../src/doacoes.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;
let tokenOng;

beforeEach(async () => {
  ({ tokenDoador, tokenOng } = await prepararBanco());
});

// Os testes abaixo usam PostgreSQL (DATABASE_URL — ver vitest.config.js e .env.example).

function dataFuturaEmDias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

describe('publicar e listar doações', () => {
  it('mostra a doação publicada na lista de disponíveis', async () => {
    await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: 'Sopa', quantidade: '10', validade: dataFuturaEmDias(10) })
      .expect(201);
    const res = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Sopa');
  });

  it('recusa doação sem os campos obrigatórios', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: 'Sopa', quantidade: '10' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigatórios/);
  });

  it('recusa doação com validade anterior à data de hoje', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: 'Sopa', quantidade: '10', validade: dataFuturaEmDias(-1) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/anterior.*hoje|hoje.*anterior/i);
  });
});

describe('filtro de doações', () => {
  it('lista somente doações do tipo informado', async () => {
    for (const tipo of ['Arroz', 'Sopa']) {
      await request(app)
        .post('/api/doacoes')
        .set('Authorization', `Bearer ${tokenDoador}`)
        .send({ tipo, quantidade: '5', validade: dataFuturaEmDias(5) })
        .expect(201);
    }
    const res = await request(app).get('/api/doacoes?tipo=arr').set('Authorization', `Bearer ${tokenOng}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Arroz');
  });

  it('responde "não encontrada" para id que não é número', async () => {
    const res = await request(app)
      .post('/api/doacoes/abc/aceitar')
      .send({ ong: 'ONG A' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });
});

describe('doação vencida', () => {
  it('não aparece na lista de disponíveis', async () => {
    await inserirVencida();
    const res = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('fica registrada com status vencida', async () => {
    const id = await inserirVencida();
    await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    const { rows } = await query('SELECT status FROM doacoes WHERE id = ?', [id]);
    expect(rows[0].status).toBe('vencida');
  });

  it('não pode ser aceita por uma ONG', async () => {
    const id = await inserirVencida();
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .set('Authorization', `Bearer ${tokenOng}`)
      .send({ ong: 'ONG A' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/vencida/);
  });

  it('continua disponível no último dia da validade', async () => {
    await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: 'Sopa', quantidade: '10', validade: dataFuturaEmDias(0) })
      .expect(201);
    const res = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(res.body).toHaveLength(1);
  });
});

describe('validação dos campos da doação', () => {
  it.each(['0', '-1', '10kg', '@@@', '   '])('recusa quantidade inválida: %s', async (quantidade) => {
    const res = await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: 'Arroz', quantidade, validade: dataFuturaEmDias(2) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/quantidade.*positiv/i);
  });

  it('recusa tipo composto somente por espaços', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .set('Authorization', `Bearer ${tokenDoador}`)
      .send({ tipo: '   ', quantidade: '10', validade: dataFuturaEmDias(2) });
    expect(res.status).toBe(400);
  });

  it('recusa ONG composta somente por espaços', async () => {
    await expect(doacoes.aceitar(999, '   ')).rejects.toThrow('ONG é obrigatória');
  });
});

afterAll(async () => {
  await encerrar();
});
