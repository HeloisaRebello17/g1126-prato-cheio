# ADR 0007 — Arquitetura em camadas e front-end estático sem framework

- **Data:** 2026-10-28
- **Status:** aceito

## Contexto
O sistema é usado no navegador do celular, com rede lenta (RNF1), por uma equipe pequena e em poucas
semanas. Também precisava permitir a troca de banco sem reescrever regras de negócio (RNF3).

## Alternativas consideradas
1. **Back-end em camadas (`app.js` → `doacoes.js` → `repositorio.js` → `db.js`) e front-end em HTML, CSS e
   JavaScript puros servido pelo próprio Express.** Prós: pouco código, sem etapa de build, página leve
   (3.122 bytes na tela de login, medidos em `docs/validacao.md`); só `db.js` conhece o banco.
   Contras: JavaScript da interface concentrado em `public/index.html`, sem componentes reutilizáveis.
2. **SPA com framework (React/Vue) e API separada.** Prós: componentes, ecossistema. Contras: maior
   download, build, dois projetos para manter, sem ganho para uma tela única.

## Decisão
**Alternativa 1.** Camadas: rotas só traduzem HTTP e erros; regras ficam em `doacoes.js` e
`autenticacao.js`; SQL fica em `repositorio.js` com marcador `?`; `db.js` converte para `$n`, expõe
`query()` → `{ rows }` e cuida do schema. A API responde sempre `4xx` com `{ erro }`, que a interface exibe.

## Consequências
- Positivas: a troca de SQLite para PostgreSQL (ADR 0001) mexeu só em `db.js`; regras testáveis
  sem HTTP (`tests/doacoes-regras.test.js`); página leve em rede lenta.
- Negativas / o que abrimos mão: `app.js` repete o bloco `try/catch` em cada rota (candidato a uma
  refatoração); a interface não é testada automaticamente.
- Riscos e o que fazer se der errado: se a interface crescer além de uma tela, extrair o JavaScript para
  arquivos em `public/` ou reavaliar um framework.

## Rastreabilidade
RNF1 (celular e internet instável) e RNF3 (portabilidade do banco); restrições de equipe pequena e prazo curto.
