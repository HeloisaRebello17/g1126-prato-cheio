# ADR 0001 — Migração de SQLite para PostgreSQL em contêiner Docker

- **Data:** 2026-10-25
- **Status:** aceito

## Contexto
O walking skeleton (U1) usava SQLite embutido no Node (`node:sqlite`). A U3 exige banco relacional
PostgreSQL acessível por `DATABASE_URL`, com CI verde. A restrição de negócio é **orçamento zero**
(decisão #1 de `docs/projeto.md`). O `src/db.js` já isolava o banco atrás de `query()` → `{ rows }`,
para que a troca ficasse contida ali.

O schema SQLite tinha duas construções que não existem no PostgreSQL:
`INTEGER PRIMARY KEY AUTOINCREMENT` e `DEFAULT (datetime('now'))` (divergência 7 de `docs/diagramas.md`).

## Alternativas consideradas
1. **PostgreSQL em contêiner Docker local (docker compose)**. Prós: custo zero; mesmo ambiente para
   todos do grupo e para o CI (service container `postgres:16-alpine`); funciona offline; o banco é
   descartável. Contras: exige Docker instalado; cada integrante tem os próprios dados.
2. **Serviço gerenciado gratuito (Neon/Supabase/Render)**. Prós: nada para instalar; dados
   compartilhados. Contras: limites do plano gratuito; depende de internet; testes rodando contra
   um banco compartilhado apagariam os dados dos colegas; credenciais reais precisam ficar fora do Git.

## Decisão
**Alternativa 1.** Ela atende ao orçamento zero, deixa o desenvolvimento local igual ao CI e
permite que os testes apaguem o banco sem afetar ninguém.

Detalhes da implementação:
- Driver `pg` com `Pool`. O SQL continua com `?`, e o `db.js` converte para `$1, $2, …`, então
  `repositorio.js` não muda.
- Schema: `id SERIAL PRIMARY KEY` e `criada_em TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Os testes usam um banco separado (`pratocheio_test`, criado pelo docker compose, ou
  `TEST_DATABASE_URL`), porque `limparBanco()` apaga a tabela a cada caso.
- **`validade` continua `TEXT` no formato `dd/mm/aaaa`.** Trocar para `DATE` (divergência 4) muda
  o contrato da API e a regra de vencimento. Fica para uma refatoração própria, para que esta
  migração seja só troca de banco, com os mesmos testes passando antes e depois.

## Consequências
- Positivas: banco igual ao exigido pela disciplina; CI com PostgreSQL real; regras de negócio,
  rotas e testes existentes intactos.
- Negativas / o que abrimos mão: cada integrante precisa de Docker (ou de um PostgreSQL próprio);
  o servidor não sobe sem `DATABASE_URL`; `validade` ainda não pode ser comparada no SQL.
- Mudança de comportamento tratada: um id de doação que não é número (ex.: `/api/doacoes/abc/aceitar`)
  fazia o PostgreSQL rejeitar a consulta com erro de tipo. Agora a API responde "doação não encontrada",
  como antes.
- Riscos e o que fazer se der errado: se a porta 5432 estiver ocupada, troque o mapeamento no
  `docker-compose.yml` e no `.env`. Se o grupo precisar de dados compartilhados (ex.: na demo), aponte
  `DATABASE_URL` para um serviço gerenciado, sem mudar código.

## Rastreabilidade
Decisão #1 de `docs/projeto.md` (onde rodar o PostgreSQL na U3); restrição "orçamento zero";
divergência 7 de `docs/diagramas.md` (resolvida) e divergência 4 (adiada, ver acima).
