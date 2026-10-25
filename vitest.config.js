export default {
  test: {
    // Os testes apagam a tabela a cada caso: usam um banco próprio
    // (pratocheio_test, criado pelo docker compose), nunca o de desenvolvimento.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgres://pratocheio:pratocheio@127.0.0.1:5432/pratocheio_test',
    },
    // Todos os arquivos de teste compartilham o mesmo banco: rodar um por vez.
    fileParallelism: false,
  },
};
