import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, query } from '../src/db.js';

export const app = criarApp();

export function dataFuturaEmDias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export async function cadastrarELogar(nome, email, perfil) {
  await request(app).post('/api/cadastro').send({ nome, email, senha: 'segura123', perfil }).expect(201);
  const res = await request(app).post('/api/login').send({ email, senha: 'segura123' }).expect(200);
  return res.body.token;
}

export async function prepararBanco() {
  await migrar();
  await limparBanco();
  return {
    tokenDoador: await cadastrarELogar('Doador', 'doador@teste.com', 'doador'),
    tokenOng: await cadastrarELogar('ONG', 'ong@teste.com', 'ong')
  };
}

export async function publicar(tokenDoador, dados = {}) {
  const res = await request(app)
    .post('/api/doacoes')
    .set('Authorization', `Bearer ${tokenDoador}`)
    .send({ tipo: 'Arroz', quantidade: '5', validade: dataFuturaEmDias(5), ...dados });
  return res.body.id;
}

export async function inserirVencida() {
  const { rows } = await query(
    'INSERT INTO doacoes (tipo, quantidade, validade) VALUES (?, ?, ?) RETURNING *',
    ['Pão', '20 unidades', dataFuturaEmDias(-1)]
  );
  return rows[0].id;
}
