import { afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar, query } from '../src/db.js';

const app = criarApp();

// Este teste já passa e não depende do banco:
// prova que a aplicação sobe e que o CI está funcionando.
describe('a aplicação sobe', () => {
  it('responde na verificação de saúde', async () => {
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// Os testes abaixo usam o banco — que na Unidade 1 é SQLite em memória:
// nada a instalar, nada a subir.

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
      .send({ tipo: 'Sopa', quantidade: '10 porções', validade: dataFuturaEmDias(10) })
      .expect(201);

    const res = await request(app).get('/api/doacoes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Sopa');
  });

  it('recusa doação sem os campos obrigatórios', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send({ tipo: 'Sopa', quantidade: '10 porções' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigatórios/);
  });

  it('recusa doação com validade anterior à data de hoje', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send({ tipo: 'Sopa', quantidade: '10 porções', validade: dataFuturaEmDias(-1) });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/anterior.*hoje|hoje.*anterior/i);
  });
});

describe('aceitar uma doação', () => {
  async function publicar() {
    const res = await request(app)
      .post('/api/doacoes')
      .send({ tipo: 'Arroz', quantidade: '5 kg', validade: dataFuturaEmDias(5) });
    return res.body.id;
  }

  it('marca a doação como aceita pela ONG', async () => {
    const id = await publicar();
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .send({ ong: 'ONG Esperança' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aceita');
    expect(res.body.ong).toBe('ONG Esperança');
  });

  it('remove a doação da lista de disponíveis depois de aceita', async () => {
    const id = await publicar();
    await request(app).post(`/api/doacoes/${id}/aceitar`).send({ ong: 'ONG A' });

    const res = await request(app).get('/api/doacoes');
    expect(res.body).toHaveLength(0);
  });
  
  it('recusa aceitar uma doação que já foi aceita por outra ONG', async () => {
    const id = await publicar();
    await request(app).post(`/api/doacoes/${id}/aceitar`).send({ ong: 'ONG A' });

    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .send({ ong: 'ONG B' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi aceita/);
  });
});

// H5a — doação vencida sai da lista.
// A API não deixa publicar com validade no passado, então a doação é inserida
// direto no banco: simula uma doação publicada antes e que venceu sem ser aceita.
describe('doação vencida', () => {
  async function inserirVencida() {
    const { rows } = await query(
      'INSERT INTO doacoes (tipo, quantidade, validade) VALUES (?, ?, ?) RETURNING *',
      ['Pão', '20 unidades', dataFuturaEmDias(-1)]
    );
    return rows[0].id;
  }

  it('não aparece na lista de disponíveis', async () => {
    await inserirVencida();
    const res = await request(app).get('/api/doacoes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('fica registrada com status "vencida"', async () => {
    const id = await inserirVencida();
    await request(app).get('/api/doacoes');

    const { rows } = await query('SELECT status FROM doacoes WHERE id = ?', [id]);
    expect(rows[0].status).toBe('vencida');
  });

  it('não pode ser aceita por uma ONG', async () => {
    const id = await inserirVencida();
    const res = await request(app)
      .post(`/api/doacoes/${id}/aceitar`)
      .send({ ong: 'ONG A' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/vencida/);
  });

  it('continua disponível no último dia da validade', async () => {
    await request(app)
      .post('/api/doacoes')
      .send({ tipo: 'Sopa', quantidade: '10 porções', validade: dataFuturaEmDias(0) })
      .expect(201);

    const res = await request(app).get('/api/doacoes');
    expect(res.body).toHaveLength(1);
  });
});

beforeEach(async () => { await migrar(); await limparBanco(); });
afterAll(async () => { await encerrar(); });
