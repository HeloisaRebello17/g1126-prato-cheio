# Documentação do Prato Cheio

Índice da documentação do projeto. Cada item diz **o que responde**.

| Documento | O que responde |
|---|---|
| [`docs/analise.md`](docs/analise.md) | Qual é o problema, quem são os stakeholders, quais histórias, regras, riscos e hipótese (Trabalho 1) |
| [`docs/projeto.md`](docs/projeto.md) | Quais decisões de projeto foram tomadas, os **requisitos não funcionais (RNF1–RNF3)**, seus impactos e tensões (Trabalho 2) |
| [`docs/adr/`](docs/adr/) | Registro das decisões arquiteturais (ver tabela abaixo) |
| [`docs/diagramas.md`](docs/diagramas.md), [`diagramas-atividade.md`](diagramas-atividade.md) | Contexto, sequência, estados, componentes e dados; análise crítica dos diagramas gerados por IA |
| [`docs/validacao.md`](docs/alidacao.md) | O produto atende aos critérios de aceite? Com que evidência? (Trabalho 3) |
| [`docs/refatoracoes.md`](docs/refatoracoes.md) | O que foi refatorado e a evidência (migração para PostgreSQL) |
| [`docs/demo.md`](docs/demo.md) | Roteiro reproduzível da demonstração |
| [`docs/retrospectivas/`](docs/retrospectivas/) | Retrospectiva de cada iteração |

## ADRs

| # | Decisão | Status |
|---|---|---|
| [0001](docs/adr/0001-migracao-sqlite-para-postgresql.md) | **Migração de SQLite para PostgreSQL em contêiner Docker** | aceito |
| [0002](docs/adr/0002-adotar-vitest.md) | Vitest como executor de testes | aceito |
| [0003](docs/adr/0003-reavaliacao-vitest-multicidades.md) | Reavaliação do Vitest com expansão multicidades | aceito (mantido) |
| [0004](docs/adr/0004-aceite-concorrente-com-update-condicional.md) | Aceite com UPDATE condicional (otimista) | aceito |
| [0005](docs/adr/0005-expiracao-sob-demanda-e-polling.md) | Expiração sob demanda e polling | aceito |
| [0006](docs/adr/0006-autenticacao-propria-scrypt-e-sessoes-em-memoria.md) | Autenticação própria (scrypt, sessões em memória) | aceito, com limitação |
| [0007](docs/adr/0007-arquitetura-em-camadas-e-front-end-estatico.md) | Camadas e front-end estático | aceito |
| [0008](docs/adr/0008-estrategia-de-testes-e-pipeline.md) | Testes com PostgreSQL real, casos de erro e cobertura no CI | aceito |

## Requisitos não funcionais e onde cada um é decidido, implementado e testado

| RNF | Impacto nas decisões | Implementação | Testes |
|---|---|---|---|
| RNF1 — celular com internet instável | Front-end estático sem framework; polling em vez de push; expiração sob demanda (ADRs 0005, 0007) | `public/index.html`, erros `{ erro }` na API | Medição manual em `validacao.md`; erros de API em `tests/erros-api.test.js` |
| RNF2 — consistência no aceite | `UPDATE ... WHERE status = 'disponivel'` em vez de lock pessimista (ADR 0004) | `src/repositorio.js` | `tests/concorrencia.test.js`, `tests/coletas.test.js`, `tests/db.test.js` |
| RNF3 — custo zero e portabilidade do banco | PostgreSQL em Docker; troca contida em `db.js` (ADRs 0001, 0007) | `src/db.js`, `docker-compose.yml` | Suíte inteira roda no PostgreSQL; `tests/db.test.js` |

Detalhes (cenário de qualidade, trade-offs e riscos) em [`projeto.md`](docs/projeto.md#requisitos-não-funcionais).
