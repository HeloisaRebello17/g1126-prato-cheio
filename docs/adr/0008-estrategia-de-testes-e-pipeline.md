# ADR 0008 — Estratégia de testes (PostgreSQL real, casos de erro e cobertura mínima no CI)

- **Data:** 2026-10-28
- **Status:** aceito

## Contexto
Depois da migração para PostgreSQL (ADR 0001), os testes passaram a depender de um banco real. As regras
de maior risco (aceite concorrente, validações, permissões) precisam de testes que cubram **situações de
erro**, não só o caminho feliz, e o CI deve impedir regressões.

## Alternativas consideradas
1. **Testes de integração contra PostgreSQL real** (banco `pratocheio_test` local, ou service container no
   CI), com `supertest` chamando o app Express. Prós: comportamento idêntico ao de produção, inclusive
   concorrência, `CHECK`, `UNIQUE` e erros de tipo. Contras: exige o PostgreSQL de pé; mais lento que mocks.
2. **Mocks do repositório / banco em memória (pg-mem, SQLite).** Prós: rápido, sem dependência. Contras:
   não reproduz concorrência real nem erros do PostgreSQL; foi justamente a diferença SQLite × PostgreSQL
   que motivou a migração.

## Decisão
**Alternativa 1.** A suíte é organizada por assunto:

| Arquivo | Foco |
|---|---|
| `tests/app.test.js` | a aplicação sobe (`/api/saude`) |
| `tests/auth.test.js` | cadastro, login e permissões (caminho principal) |
| `tests/doacoes.test.js`, `tests/coletas.test.js` | publicar, filtrar, vencimento, aceitar, cancelar |
| `tests/erros-api.test.js` | 401/403/400/404, JSON malformado, senha em texto puro, injeção de SQL |
| `tests/doacoes-regras.test.js` | valores de borda (datas, quantidade, ids) e ciclo de vida |
| `tests/concorrencia.test.js` | 10 ONGs disputando uma doação; aceite × cancelamento; cadastro duplicado |
| `tests/db.test.js` | contrato de `query()`, idempotência de `migrar()`, restrições do schema |

Ajustes na pipeline (`.github/workflows/`): cobertura com limites mínimos (linhas, instruções e funções
≥ 90%, ramos ≥ 85%) que **fazem o CI falhar** se caírem; relatório de cobertura publicado como artefato e
resumo no PR; teste de idempotência da migração; `server.js` incluído em `npm run check`; execução também
em `push` na `main`; `permissions: contents: read`; `timeout-minutes`; auditoria de dependências
(informativa, não bloqueia).

## Consequências
- Positivas: erros reais do PostgreSQL são exercitados; defeitos injetados de propósito no código
  (remover o `AND status = 'disponivel'`, remover a checagem de perfil, aceitar datas inexistentes, enviar
  id inválido ao banco, gravar senha em texto puro, cancelar sem checar o dono) foram **todos detectados**.
- Negativas / o que abrimos mão: o CI e os testes locais precisam do PostgreSQL; a interface
  (`public/index.html`) não tem teste automatizado; o limite de ramos de `db.js` é baixo porque o erro de
  `DATABASE_URL` ausente roda na importação do módulo.
- Riscos e o que fazer se der errado: se um teste de concorrência ficar instável, reduzir o número de
  requisições simultâneas antes de afrouxar a asserção; nunca apontar `TEST_DATABASE_URL` para o banco de
  desenvolvimento (`limparBanco()` apaga tudo).

## Rastreabilidade
RNF2 (consistência), RNF3 (migração com os mesmos testes) e ADRs 0001, 0002 e 0004.
