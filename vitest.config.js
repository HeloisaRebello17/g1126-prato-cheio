import { existsSync } from 'node:fs';

// Lê TEST_DATABASE_URL do .env local (ex.: quem mudou a porta por conflito com outro PostgreSQL).
// Variáveis já definidas no ambiente (CI) têm prioridade.
if (!process.env.TEST_DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

export default {
  test: {
    // Os testes apagam as tabelas a cada caso: usam um banco próprio
    // (pratocheio_test, criado pelo docker compose), nunca o de desenvolvimento.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://pratocheio:pratocheio@127.0.0.1:5432/pratocheio_test'
    },
    // Todos os arquivos de teste compartilham o mesmo banco: rodar um por vez.
    fileParallelism: false,
    // `npm run test:cobertura` (usado no CI). server.js só sobe o servidor e é verificado
    // pelo passo "Verificar se a aplicação sobe" do workflow, por isso fica fora da conta.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 }
    }
  }
};
