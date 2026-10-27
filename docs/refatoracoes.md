# Refatorações — Prato Cheio

*Trabalho 3 · uma seção por refatoração · o que importa é o motivo e a evidência*

## Refatoração 1 — Migração de SQLite para PostgreSQL

- **Motivo:** a U3 exige PostgreSQL acessível por `DATABASE_URL` com CI verde; orçamento zero levou
  a rodar em contêiner Docker ([ADR 0001](adr/0001-migracao-sqlite-para-postgresql.md), decisão #1 do `projeto.md`).
- **O que mudou:**
  - `src/db.js` — `node:sqlite` → `pg` (`Pool`); conversão `?` → `$n`; schema com `SERIAL` e
    `TIMESTAMPTZ DEFAULT now()`; `TRUNCATE ... RESTART IDENTITY` nos testes; leitura do `.env`.
  - `src/doacoes.js` — id que não é número responde "doação não encontrada" (no PostgreSQL viraria erro de tipo).
  - `docker-compose.yml` + `docker/postgres-init/` — PostgreSQL 16 local, com banco de testes separado.
  - `vitest.config.js` — testes no banco `pratocheio_test` (nunca no de desenvolvimento), um arquivo por vez.
  - `.github/workflows/ci.yml` — service container PostgreSQL.
  - `package.json` — dependência `pg`; saíram as flags que só existiam por causa do `node:sqlite`.
  - `README.md`, `.env.example` — como subir, conectar e testar o banco.
- **O que NÃO mudou:** regras de negócio, rotas da API, o SQL de `src/repositorio.js` e os 11 testes
  existentes (só foi atualizado um comentário). `validade` continua `TEXT dd/mm/aaaa` (ver ADR).
- **Evidência de que o comportamento se manteve:**
  - testes antes da mudança (commit `5af303d`, SQLite): **11 passando**
  - testes depois da mudança (PostgreSQL 16): **12 passando**, ou seja, os mesmos 11 mais um novo
    para id inválido
  - link da execução do CI verde: (preencher após abrir o PR da branch `migrarBD_Julio`)

## Refatoração 2 — (nome)

- **Cheiro de código atacado:** (duplicação, função longa, nome que engana, regra na rota…)
- **Qual dor concreta isso resolvia:**
- **O que mudou:**
- **Evidência (testes verdes antes e depois):**

---

**Limitações e o que ficou de fora:** (o que vocês viram e decidiram não refatorar, e por quê)
