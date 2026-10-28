# Documentação de testes e pipeline — Prato Cheio

Este documento descreve **o que é testado, como, e por que cada teste existe**, incluindo as situações de
erro, e **os ajustes feitos na pipeline de CI**. Decisão registrada no
[ADR 0008](adr/0008-estrategia-de-testes-e-pipeline.md).

## 1. Estratégia

- **Testes de integração contra PostgreSQL real.** O app Express é chamado com `supertest`, sem subir
  porta, e grava no banco `pratocheio_test`. Não há mocks do banco: foi a diferença entre SQLite e
  PostgreSQL que motivou a migração, e só um banco real reproduz concorrência, `CHECK`, `UNIQUE` e erros
  de tipo.
- **Isolamento.** Cada caso começa com `migrar()` + `limparBanco()` (`TRUNCATE ... RESTART IDENTITY`) e cria
  um doador e uma ONG novos (`tests/helpers.js`). Por compartilharem o banco, os arquivos rodam **um por
  vez** (`fileParallelism: false` em `vitest.config.js`).
- **Ferramentas:** Vitest 5 ([ADR 0002](adr/0002-adotar-vitest.md)), `supertest`, cobertura `v8`.
- **Segurança do banco:** `vitest.config.js` aponta para `pratocheio_test` (ou `TEST_DATABASE_URL`).
  Nunca aponte para o banco de desenvolvimento, porque os testes apagam os dados.

## 2. Resultado atual

| Arquivo | Testes | Foco |
|---|:--:|---|
| `tests/app.test.js` | 1 | A aplicação responde em `/api/saude` |
| `tests/auth.test.js` | 7 | Cadastro, login, e-mail `.com`, proteção por perfil |
| `tests/doacoes.test.js` | 16 | Publicar, filtrar, doação vencida, validação de campos |
| `tests/coletas.test.js` | 6 | Aceitar, aceite duplicado, 2 ONGs simultâneas, cancelar |
| `tests/erros-api.test.js` | 36 | Erros de autenticação, autorização e entrada; entradas hostis |
| `tests/doacoes-regras.test.js` | 49 | Valores de borda e ciclo de vida das doações |
| `tests/concorrencia.test.js` | 4 | Disputa simultânea pelo aceite (RNF2) |
| `tests/db.test.js` | 21 | Contrato de `query()`, schema e restrições |
| **Total** | **140** | 30 já existiam; 110 são novos |

Cobertura de `src/` (excluindo `server.js`, que é verificado pelo passo "Verificar se a aplicação sobe"
do CI):

| Módulo | Linhas | Instruções | Funções | Ramos |
|---|:--:|:--:|:--:|:--:|
| `app.js` | 94,1% | 94,4% | 100% | 100% |
| `autenticacao.js` | 100% | 97,7% | 100% | 97,5% |
| `db.js` | 95,5% | 88,5% | 87,5% | 76,5% |
| `doacoes.js` | 100% | 100% | 100% | 100% |
| `repositorio.js` | 100% | 100% | 100% | 100% |
| **Total** | **98,1%** | **96,7%** | **97,9%** | **95,8%** |

O que ficou sem cobertura: dois `catch` de rotas em `app.js` (listagem e minhas-coletas, só dispararia com
falha do banco) e a mensagem de erro de `DATABASE_URL` ausente em `db.js`, que roda na importação do módulo.

## 3. Situações de erro cobertas

| Categoria | Casos | Resposta esperada | Arquivo |
|---|---|---|---|
| Token ausente ou inválido | Sem cabeçalho, esquema `Basic`, `Bearer` vazio, token inexistente | `401` | `erros-api` |
| Rotas protegidas | 5 rotas sem token | `401` | `erros-api` |
| Perfil sem permissão | Doador listando, aceitando, cancelando; ONG publicando | `403`, estado do banco **não** muda | `erros-api` |
| Cadastro inválido | Nome/e-mail/senha/perfil ausentes ou do tipo errado; senha < 6; perfil `admin`; corpo vazio ou array | `400`, nenhum usuário criado | `erros-api` |
| E-mail | Fora do formato `.com`; duplicado sem diferenciar maiúsculas | `400` | `auth`, `erros-api` |
| Senha | Nunca gravada em texto puro (formato `sal:hash`) | — | `erros-api` |
| Login inválido | Corpo vazio, senha ausente, e-mail inexistente, senha errada | `401`; mesma mensagem para e-mail inexistente e senha errada | `erros-api` |
| Entradas hostis | JSON malformado; rota inexistente; texto de SQL injection no filtro e nos campos; parâmetro repetido | `400` / `404` / tratado como dado; tabelas intactas | `erros-api` |
| Validade | Formato ISO, sem zero à esquerda, texto, vazio, número; 31/02, dia 0, dia 32, mês 13; 29/02 em ano bissexto e comum; data passada | `400`; nada é gravado | `doacoes-regras`, `doacoes` |
| Quantidade e tipo | `0`, negativo, `10kg`, símbolos, espaços; valor que não é texto (número, booleano, objeto, nulo, lista) | `400` | `doacoes-regras`, `doacoes` |
| Ids inválidos | Inexistente, negativo, decimal, acima do limite do `int4`, texto | `400 — "não encontrada"`, sem erro de tipo do PostgreSQL | `doacoes-regras` |
| Regras de negócio | Aceitar doação já aceita (mesma ou outra ONG); aceitar vencida; cancelar sem ter aceitado; cancelar duas vezes; cancelar coleta de outra ONG | `400` | `coletas`, `doacoes-regras` |
| Concorrência | 10 ONGs no mesmo aceite; aceite × cancelamento; 5 cadastros iguais simultâneos | 1 sucesso, demais `400`; estado final consistente | `concorrencia` |
| Banco | SQL inválido; tipo incompatível; `UNIQUE`, `CHECK` e `NOT NULL` violados | Exceção, nunca resultado vazio silencioso | `db` |

## 4. Como o teste prova que detecta defeitos (teste de mutação manual)

Cobertura mostra que o código **executou**, não que os testes **notariam um defeito**. Por isso foram
injetados, um por vez, 6 defeitos no código-fonte; em todos a suíte falhou, e o código foi restaurado depois
(suíte voltou a 140/140).

| # | Defeito injetado | Arquivo | Testes que falharam |
|---|---|---|---|
| 1 | Aceite sem `AND status = 'disponivel'` (perde atomicidade) | `repositorio.js` | 2 (`concorrencia`, `db`) |
| 2 | Rota de aceitar sem `exigirPerfil('ong')` | `app.js` | 2 (`erros-api`) |
| 3 | Validação de calendário removida (aceita 31/02) | `doacoes.js` | 5 (`doacoes-regras`) |
| 4 | Id inválido enviado ao banco | `doacoes.js` | 3 (`doacoes-regras`) |
| 5 | Senha gravada em texto puro | `autenticacao.js` | 36 (login deixa de funcionar) |
| 6 | Cancelamento sem checar o dono da coleta | `repositorio.js` | 8 |

Observação honesta: uma primeira tentativa de mutação 3 (remover só a checagem do **dia**) sobreviveu, porque
a checagem do mês já cobre os mesmos casos (mutante equivalente). Removendo a validação de calendário inteira,
os testes detectaram.

Estabilidade: a suíte de concorrência foi repetida 5 vezes seguidas sem falha.

## 5. Como executar

```bash
docker compose up -d            # PostgreSQL (cria também o banco pratocheio_test)
cp .env.example .env
npm install

npm test                        # os 140 testes
npm run test:cobertura          # testes + cobertura; falha abaixo dos mínimos
npx vitest run tests/concorrencia.test.js   # um arquivo
npm run quality                 # ESLint + Prettier
npm run ci                      # o mesmo que o CI executa (sintaxe + cobertura)
```

Tempo: cerca de 40 s para a suíte inteira (dominado pelo `scrypt` do cadastro, que é lento de propósito).

## 6. Ajustes feitos na pipeline

Arquivos: `.github/workflows/ci.yml`, `lint.yml`, `prettier.yml`, `package.json`, `vitest.config.js`.

| Ajuste | Por quê |
|---|---|
| `npm run ci` agora roda **testes com cobertura** e **falha** se linhas/instruções/funções < 90% ou ramos < 85% | A cobertura vira um portão de qualidade, não só um relatório |
| `npm run check` passou a incluir `src/server.js` | Era o único arquivo de `src/` fora da checagem de sintaxe |
| Relatório de cobertura publicado como **artefato** (14 dias) e **resumo no PR** (`GITHUB_STEP_SUMMARY`) | O revisor vê a cobertura sem rodar nada |
| Passo **"migração é idempotente"** (`npm run db:migrar` duas vezes) | `npm start` migra a cada subida; precisa ser seguro repetir |
| CI também em **`push` na `main`** e `workflow_dispatch` (lint e prettier também em `push`) | Detecta quebra que chegue à `main` e permite rodar sob demanda |
| `permissions: contents: read` | Menor privilégio: o CI só lê o repositório |
| `timeout-minutes` (10 no CI, 5 nos demais) | Evita job preso consumindo minutos |
| Job **`auditoria-dependencias`** (`npm audit --omit=dev --audit-level=high`) com `continue-on-error` | Deixa vulnerabilidades visíveis sem bloquear o PR |
| `coverage/` no `.gitignore`; dependência `@vitest/coverage-v8` | Suporte à cobertura |

Mantido: service container `postgres:16-alpine`, `concurrency` com cancelamento, e o passo "Verificar se a
aplicação sobe" (`/api/saude`).

**Não verificado:** os workflows não foram executados no GitHub (não tenho acesso ao repositório); foram
validados apenas por `npm run ci` e `npm run quality` locais, contra um PostgreSQL 16. A primeira execução no
GitHub confirma o restante. Se a auditoria ou o upload do artefato falhar por política da organização, o
resto da pipeline continua válido.

## 7. Limitações e próximos passos

- Sem teste automatizado da interface (`public/index.html`).
- O limite de ramos de `db.js` (76,5%) é baixo por causa do erro de `DATABASE_URL` ausente na importação.
- Testes de carga e de desempenho (RNF1) não existem; a medição é manual.
- Se um teste de concorrência ficar instável no CI, reduza o número de requisições simultâneas antes de
  afrouxar a asserção.
