// Testes de caracterização das rotas: travam o status HTTP de sucesso e de erro de cada rota,
// e o que cada uma repassa para as regras. As regras (src/doacoes.js) são simuladas para
// conseguir forçar erro em qualquer rota — inclusive nas que, na prática, quase nunca falham.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, prepararBanco } from './helpers.js';
import * as doacoes from '../src/doacoes.js';
import { encerrar } from '../src/db.js';

vi.mock('../src/doacoes.js', async (importOriginal) => {
  const original = await importOriginal();
  return Object.fromEntries(
    Object.entries(original).map(([nome, valor]) => [nome, typeof valor === 'function' ? vi.fn() : valor])
  );
});

let tokens;

beforeEach(async () => {
  vi.clearAllMocks();
  const { tokenDoador, tokenOng } = await prepararBanco();
  tokens = { doador: tokenDoador, ong: tokenOng };
});

// [método, caminho, perfil, função das regras, status de sucesso, status de erro]
const rotas = [
  ['get', '/api/doacoes', 'ong', 'listarDisponiveis', 200, 400],
  ['get', '/api/minhas-coletas', 'ong', 'listarAceitas', 200, 400],
  ['post', '/api/doacoes', 'doador', 'criarDoacao', 201, 400],
  ['post', '/api/doacoes/7/aceitar', 'ong', 'aceitar', 200, 400],
  ['post', '/api/doacoes/7/cancelar', 'ong', 'cancelar', 200, 400],
  ['get', '/api/minhas-doacoes', 'doador', 'listarPublicadas', 200, 400],
  ['post', '/api/doacoes/7/cancelar-publicacao', 'doador', 'cancelarPeloDoador', 200, 400],
  ['get', '/api/doacoes/7/historico', 'doador', 'historico', 200, 404]
];

describe.each(rotas)('%s %s', (metodo, caminho, perfil, funcao, statusOk, statusErro) => {
  it(`responde ${statusOk} com o resultado das regras`, async () => {
    vi.mocked(doacoes[funcao]).mockResolvedValueOnce({ resultado: funcao });
    const res = await request(app)[metodo](caminho).set('Authorization', `Bearer ${tokens[perfil]}`);
    expect(res.status).toBe(statusOk);
    expect(res.body).toEqual({ resultado: funcao });
  });

  it(`responde ${statusErro} com a mensagem quando as regras falham`, async () => {
    vi.mocked(doacoes[funcao]).mockRejectedValueOnce(new Error('falha simulada'));
    const res = await request(app)[metodo](caminho).set('Authorization', `Bearer ${tokens[perfil]}`);
    expect(res.status).toBe(statusErro);
    expect(res.body).toEqual({ erro: 'falha simulada' });
  });
});

describe('o que as rotas repassam para as regras', () => {
  const auth = (perfil) => ({ Authorization: `Bearer ${tokens[perfil]}` });

  it('cancelar-publicacao responde 404 quando a doação não é encontrada', async () => {
    vi.mocked(doacoes.cancelarPeloDoador).mockRejectedValueOnce(new Error('doação não encontrada'));
    const res = await request(app).post('/api/doacoes/7/cancelar-publicacao').set(auth('doador'));
    expect(res.status).toBe(404);
  });

  it('repassa id da URL, usuário autenticado, corpo e filtro', async () => {
    for (const funcao of rotas.map((r) => r[3])) vi.mocked(doacoes[funcao]).mockResolvedValue({});

    await request(app).get('/api/doacoes').query({ tipo: 'Arroz' }).set(auth('ong'));
    await request(app).get('/api/minhas-coletas').set(auth('ong'));
    await request(app).post('/api/doacoes').set(auth('doador')).send({ tipo: 'Pão' });
    await request(app).post('/api/doacoes/7/aceitar').set(auth('ong'));
    await request(app).post('/api/doacoes/7/cancelar').set(auth('ong'));
    await request(app).get('/api/minhas-doacoes').set(auth('doador'));
    await request(app).post('/api/doacoes/7/cancelar-publicacao').set(auth('doador')).send({ motivo: 'estragou' });
    await request(app).get('/api/doacoes/7/historico').set(auth('doador'));

    const idDoador = 1; // primeiro usuário cadastrado em prepararBanco
    expect(doacoes.listarDisponiveis).toHaveBeenCalledWith('Arroz');
    expect(doacoes.listarAceitas).toHaveBeenCalledWith('ONG');
    expect(doacoes.criarDoacao).toHaveBeenCalledWith({ tipo: 'Pão' }, idDoador);
    expect(doacoes.aceitar).toHaveBeenCalledWith('7', 'ONG');
    expect(doacoes.cancelar).toHaveBeenCalledWith('7', 'ONG');
    expect(doacoes.listarPublicadas).toHaveBeenCalledWith(idDoador);
    expect(doacoes.cancelarPeloDoador).toHaveBeenCalledWith('7', idDoador, 'estragou');
    expect(doacoes.historico).toHaveBeenCalledWith('7', idDoador);
  });
});

afterAll(async () => {
  await encerrar();
});
