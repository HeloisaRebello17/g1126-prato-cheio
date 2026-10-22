export default {
  test: {
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgres://pratocheio:pratocheio@127.0.0.1:5432/pratocheio',
    },
  },
};
