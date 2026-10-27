-- Roda só na primeira vez que o volume do PostgreSQL é criado.
-- Banco separado para `npm test`, que apaga a tabela a cada caso de teste.
CREATE DATABASE pratocheio_test OWNER pratocheio;
