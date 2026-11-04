# ADR 0009 — Migrações versionadas do schema do PostgreSQL

- **Data:** 2026-11-04
- **Status:** aceito

## Contexto
Até a U3, `migrar()` (em `src/db.js`) era um único `CREATE TABLE IF NOT EXISTS`. Isso bastava para criar o
banco do zero (ADR 0001), mas não consegue **evoluir** um banco que já existe: um `CREATE TABLE IF NOT
EXISTS doacoes (... doador_id ...)` não acrescenta a coluna nova em quem já tem a tabela. A história H5c
(estabelecimento cancela a doação com motivo) é a primeira que muda o schema, com a coluna `doador_id` e a
tabela `historico_doacao`. O modelo alvo de `docs/diagramas-atividade.md` (seção 4.3) ainda prevê outras
mudanças: `ong_id`, `aceita_em`/`coletada_em`, `unidade`, `validade DATE`.

Restrições: orçamento zero, equipe pequena, `npm start` migra a cada subida (precisa ser idempotente) e o
CI roda `npm run db:migrar` duas vezes.

## Alternativas consideradas
1. **Lista de migrações numeradas em `db.js` + tabela `schema_migracoes`** (feito à mão). Prós: nenhuma
   dependência nova; ~40 linhas; cada migração roda numa transação e uma única vez. Contras: sem
   *rollback* automático (`down`) e sem CLI para gerar arquivos.
2. **Ferramenta pronta (node-pg-migrate, Knex, Prisma).** Prós: `up`/`down`, CLI, convenções conhecidas.
   Contras: dependência e configuração novas para duas migrações; Knex/Prisma trariam também query
   builder/ORM, que o projeto não usa (ADR 0007).
3. **Continuar com `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.** Prós: zero mudança. Contras: cresce sem
   ordem nem registro do que já rodou; mudanças de tipo (ex.: `validade` para `DATE`) não ficam
   idempotentes desse jeito.

## Decisão
**Alternativa 1.** `MIGRACOES` em `src/db.js` é uma lista `{ versao, nome, sql }`. `migrar()`:
- pega um *advisory lock* do PostgreSQL, para que dois processos não migrem ao mesmo tempo;
- cria `schema_migracoes` se não existir e aplica, em ordem, só as versões que faltam;
- roda cada migração numa transação; se falhar, desfaz tudo e não a marca como aplicada.

A migração 1 é o schema da U3 com `IF NOT EXISTS`, para que bancos criados antes deste ADR passem a ser
controlados sem perder dados. A migração 2 é a da H5c.

**Regra do grupo:** migração já integrada na `main` não se edita; cria-se a próxima versão.

## Consequências
- Positivas: o banco de cada integrante, o do CI e o da demo evoluem do mesmo jeito com `npm start` ou
  `npm run db:migrar`; fica registrado o que rodou e quando; a próxima mudança do modelo alvo é só
  acrescentar um item na lista.
- Negativas / o que abrimos mão: sem `down`. Para desfazer, escreve-se uma nova migração que reverte.
- Riscos e o que fazer se der errado: duas branches criando a mesma `versao` → o teste "versões únicas e
  crescentes" e a revisão do PR pegam; quem integrar por último renumera. Se o projeto passar a ter
  muitas migrações ou precisar de `down`, trocar pela alternativa 2: a tabela `schema_migracoes` facilita
  essa troca.

## Rastreabilidade
ADR 0001 (PostgreSQL); RNF3 (portabilidade do banco, troca contida em `db.js`); H5c; seção 4.3 de
`docs/diagramas-atividade.md` (do modelo atual ao modelo alvo). Testes em `tests/db.test.js`: registro das
versões, atualização de um banco antigo sem perda de dados e *rollback* de migração que falha.
