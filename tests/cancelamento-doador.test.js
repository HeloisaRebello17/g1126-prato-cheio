// H5c — "o estabelecimento cancela manualmente uma doação, registrando o motivo".
// Critério de aceite (docs/analise.md): cancelamento manual → motivo registrado no histórico.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, cadastrarELogar, inserirVencida, prepararBanco, publicar } from './helpers.js';
import { encerrar, query } from '../src/db.js';

let tokenDoador;
let tokenOng;

beforeEach(async () => {
  ({ tokenDoador, tokenOng } = await prepararBanco());
});

function cancelarPublicacao(id, motivo, token = tokenDoador) {
  return request(app)
    .post(`/api/doacoes/${id}/cancelar-publicacao`)
    .set('Authorization', `Bearer ${token}`)
    .send(motivo === undefined ? {} : { motivo });
}

describe('estabelecimento cancela uma doação com motivo (H5c)', () => {
  it('cancela uma doação disponível e ela sai da lista das ONGs', async () => {
    const id = await publicar(tokenDoador);
    const res = await cancelarPublicacao(id, 'Alimento estragou na geladeira');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelada');
    const lista = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(lista.body).toHaveLength(0);
  });

  it('registra o motivo no histórico da doação', async () => {
    const id = await publicar(tokenDoador);
    await cancelarPublicacao(id, '  Loja fechou mais cedo  ').expect(200);
    const res = await request(app).get(`/api/doacoes/${id}/historico`).set('Authorization', `Bearer ${tokenDoador}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      status_anterior: 'disponivel',
      status_novo: 'cancelada',
      motivo: 'Loja fechou mais cedo'
    });
    expect(res.body[0].registrado_em).toEqual(expect.any(String));
  });

  it('cancela uma doação já aceita e ela some das coletas da ONG', async () => {
    const id = await publicar(tokenDoador);
    await request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOng}`).expect(200);
    await cancelarPublicacao(id, 'ONG não apareceu e o alimento venceu').expect(200);
    const coletas = await request(app).get('/api/minhas-coletas').set('Authorization', `Bearer ${tokenOng}`);
    expect(coletas.body).toHaveLength(0);
    const historico = await request(app)
      .get(`/api/doacoes/${id}/historico`)
      .set('Authorization', `Bearer ${tokenDoador}`);
    expect(historico.body[0].status_anterior).toBe('aceita');
  });

  it.each([
    ['sem motivo', undefined],
    ['motivo vazio', '   '],
    ['motivo que não é texto', 123]
  ])('exige o motivo (%s)', async (_caso, motivo) => {
    const id = await publicar(tokenDoador);
    const res = await cancelarPublicacao(id, motivo);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/motivo do cancelamento é obrigatório/);
    const lista = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`);
    expect(lista.body).toHaveLength(1);
  });

  it('limita o tamanho do motivo', async () => {
    const id = await publicar(tokenDoador);
    const res = await cancelarPublicacao(id, 'x'.repeat(501));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/no máximo 500/);
  });

  it('não cancela duas vezes e não grava histórico repetido', async () => {
    const id = await publicar(tokenDoador);
    await cancelarPublicacao(id, 'primeiro').expect(200);
    const res = await cancelarPublicacao(id, 'segundo');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já está cancelada/);
    const historico = await request(app)
      .get(`/api/doacoes/${id}/historico`)
      .set('Authorization', `Bearer ${tokenDoador}`);
    expect(historico.body).toHaveLength(1);
  });

  it('não cancela uma doação que já venceu', async () => {
    // A API não publica doação com validade no passado; o helper insere direto no banco.
    const id = await inserirVencida();
    const { rows } = await query(
      'UPDATE doacoes SET doador_id = (SELECT id FROM usuarios WHERE email = ?) WHERE id = ? RETURNING id',
      ['doador@teste.com', id]
    );
    expect(rows).toHaveLength(1);
    await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenOng}`); // expira (H5a)
    const res = await cancelarPublicacao(id, 'motivo');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já está vencida/);
  });

  it('um doador não cancela nem vê o histórico da doação de outro', async () => {
    const id = await publicar(tokenDoador);
    const outroDoador = await cadastrarELogar('Mercado', 'mercado@teste.com', 'doador');
    const res = await cancelarPublicacao(id, 'não é minha', outroDoador);
    expect(res.status).toBe(404);
    expect(res.body.erro).toBe('doação não encontrada');
    const historico = await request(app)
      .get(`/api/doacoes/${id}/historico`)
      .set('Authorization', `Bearer ${outroDoador}`);
    expect(historico.status).toBe(404);
  });

  it.each(['abc', '99999'])('responde 404 para id inexistente ou inválido (%s)', async (id) => {
    expect((await cancelarPublicacao(id, 'motivo')).status).toBe(404);
    const historico = await request(app)
      .get(`/api/doacoes/${id}/historico`)
      .set('Authorization', `Bearer ${tokenDoador}`);
    expect(historico.status).toBe(404);
  });

  it('só o perfil doador pode cancelar a publicação', async () => {
    const id = await publicar(tokenDoador);
    expect((await cancelarPublicacao(id, 'motivo', tokenOng)).status).toBe(403);
    expect((await request(app).post(`/api/doacoes/${id}/cancelar-publicacao`).send({ motivo: 'x' })).status).toBe(401);
  });

  it('a ONG não consegue aceitar uma doação cancelada', async () => {
    const id = await publicar(tokenDoador);
    await cancelarPublicacao(id, 'motivo').expect(200);
    const res = await request(app).post(`/api/doacoes/${id}/aceitar`).set('Authorization', `Bearer ${tokenOng}`);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/cancelada pelo estabelecimento/);
  });
});

describe('minhas doações', () => {
  it('lista só as doações do doador logado, com o status atual', async () => {
    const primeira = await publicar(tokenDoador, { tipo: 'Pão' });
    const segunda = await publicar(tokenDoador, { tipo: 'Sopa' });
    const outroDoador = await cadastrarELogar('Mercado', 'mercado2@teste.com', 'doador');
    await publicar(outroDoador, { tipo: 'Feijão' });
    await cancelarPublicacao(primeira, 'motivo').expect(200);

    const res = await request(app).get('/api/minhas-doacoes').set('Authorization', `Bearer ${tokenDoador}`);
    expect(res.status).toBe(200);
    expect(res.body.map((d) => [d.id, d.status])).toEqual([
      [segunda, 'disponivel'],
      [primeira, 'cancelada']
    ]);
  });

  it('é exclusiva do perfil doador', async () => {
    expect((await request(app).get('/api/minhas-doacoes').set('Authorization', `Bearer ${tokenOng}`)).status).toBe(403);
  });
});

afterAll(async () => {
  await encerrar();
});
