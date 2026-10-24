import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import { encerrar } from '../src/db.js';

describe('aplicação', () => {
  it('responde na verificação de saúde', async () => {
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

afterAll(async () => {
  await encerrar();
});
