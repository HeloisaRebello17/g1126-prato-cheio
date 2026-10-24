import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, prepararBanco } from './helpers.js';
import { encerrar } from '../src/db.js';

let tokenDoador;

beforeEach(async () => {
  ({ tokenDoador } = await prepararBanco());
});

describe('cadastro e login', () => {
  it('cadastra uma ONG e autentica com senha', async () => {
    const cadastro = await request(app)
      .post('/api/cadastro')
      .send({ nome: 'Nova ONG', email: 'nova@ong.com', senha: 'segura123', perfil: 'ong' });
    expect(cadastro.status).toBe(201);
    expect(cadastro.body.senha).toBeUndefined();

    const login = await request(app).post('/api/login').send({ email: 'nova@ong.com', senha: 'segura123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.usuario.perfil).toBe('ong');
  });

  it('recusa senha incorreta e e-mail duplicado', async () => {
    expect((await request(app).post('/api/login').send({ email: 'doador@teste.com', senha: 'errada' })).status).toBe(
      401
    );
    expect(
      (
        await request(app)
          .post('/api/cadastro')
          .send({ nome: 'Outro', email: 'doador@teste.com', senha: 'segura123', perfil: 'doador' })
      ).status
    ).toBe(400);
  });

  it.each(['email.com', 'email@dominio.org', 'email@dominio.com.br', 'email sem@dominio.com'])(
    'recusa e-mail fora do formato .com: %s',
    async (email) => {
      const res = await request(app)
        .post('/api/cadastro')
        .send({ nome: 'Pessoa', email, senha: 'segura123', perfil: 'doador' });
      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/@.*\.com/);
    }
  );

  it('protege a API e respeita o perfil', async () => {
    expect((await request(app).get('/api/doacoes')).status).toBe(401);
    expect((await request(app).get('/api/doacoes').set('Authorization', `Bearer ${tokenDoador}`)).status).toBe(403);
  });
});

afterAll(async () => {
  await encerrar();
});
