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

describe('cancelar coleta com observação (H4)', () => {
  const comToken = (token) => ({ Authorization: `Bearer ${token}` });

  async function aceitarECancelar(corpo) {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    const res = await request(app).post(`/api/doacoes/${id}/cancelar`).set(comToken(tokenOng)).send(corpo);
    return { id, res };
  }

  const historico = (id) => request(app).get(`/api/doacoes/${id}/historico`).set(comToken(tokenDoador));

  it('registra a observação no histórico e o estabelecimento a vê em minhas doações', async () => {
    const { id, res } = await aceitarECancelar({ observacao: '  Sem veículo hoje  ' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disponivel');

    expect((await historico(id)).body).toMatchObject([
      { status_anterior: 'aceita', status_novo: 'disponivel', motivo: 'Sem veículo hoje' }
    ]);

    const minhas = await request(app).get('/api/minhas-doacoes').set(comToken(tokenDoador)).expect(200);
    expect(minhas.body[0]).toMatchObject({
      id,
      status: 'disponivel',
      ultimo_historico: { status_anterior: 'aceita', status_novo: 'disponivel', motivo: 'Sem veículo hoje' }
    });
  });

  it.each([[{}], [{ observacao: '' }], [{ observacao: '   ' }], [{ observacao: null }]])(
    'a observação é opcional: %j cancela e registra sem observação',
    async (corpo) => {
      const { id, res } = await aceitarECancelar(corpo);
      expect(res.status).toBe(200);
      expect((await historico(id)).body).toMatchObject([{ status_novo: 'disponivel', motivo: null }]);
    }
  );

  it.each([
    [{ observacao: 123 }, 'observação deve ser um texto'],
    [{ observacao: ['a'] }, 'observação deve ser um texto'],
    [{ observacao: 'x'.repeat(501) }, 'observação deve ter no máximo 500 caracteres']
  ])('recusa observação inválida %#, sem mudar a doação', async (corpo, erro) => {
    const { id, res } = await aceitarECancelar(corpo);
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe(erro);
    const coletas = await request(app).get('/api/minhas-coletas').set(comToken(tokenOng));
    expect(coletas.body.map((d) => d.id)).toEqual([id]);
    expect((await historico(id)).body).toEqual([]);
  });

  it('cancelamento recusado (coleta de outra ONG) não grava histórico', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set(comToken(tokenOng)).expect(200);
    const outraOng = await cadastrarELogar('Outra ONG', 'outra2@teste.com', 'ong');
    await request(app)
      .post(`/api/doacoes/${id}/cancelar`)
      .set(comToken(outraOng))
      .send({ observacao: 'não é minha' })
      .expect(400);
    expect((await historico(id)).body).toEqual([]);
  });

  it('minhas doações traz ultimo_historico nulo quando nada foi registrado', async () => {
    const id = await publicar(tokenDoador);
    const minhas = await request(app).get('/api/minhas-doacoes').set(comToken(tokenDoador)).expect(200);
    expect(minhas.body).toMatchObject([{ id, ultimo_historico: null }]);
  });
});

afterAll(async () => {
  await encerrar();
});
