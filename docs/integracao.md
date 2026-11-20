# Integração — Prato Cheio

*Trabalho 4 · integrar os incrementos da equipe e provar que o sistema funciona como um todo*

Este documento responde: **o que pesquisamos sobre integração, como integramos o Prato Cheio, o que deu
errado na integração e qual a evidência de que o sistema integrado funciona.** O confronto com os
critérios de aceite está em [`validacao.md`](validacao.md); o roteiro da demo em [`demo.md`](demo.md);
a retrospectiva em [`retrospectivas/u2-integracao.md`](retrospectivas/u2-integracao.md).

---

## 1. Pesquisa: conceitos e como se aplicam ao projeto

| Conceito | O que é | Como aparece no Prato Cheio |
|---|---|---|
| **Integração Contínua (CI)** | Prática de integrar o trabalho de cada pessoa na branch principal com frequência (várias vezes por semana, idealmente por dia), e a cada integração rodar automaticamente build e testes. O objetivo é descobrir problemas de integração cedo, quando são pequenos, em vez de num "big bang" no fim. | Três workflows do GitHub Actions rodam em todo PR e todo push na `main`: [`ci.yml`](../.github/workflows/ci.yml) (testes com PostgreSQL 16 real, cobertura mínima, migração idempotente, app sobe e responde `/api/saude`), [`lint.yml`](../.github/workflows/lint.yml) e [`prettier.yml`](../.github/workflows/prettier.yml). |
| **Pull Request (PR)** | Pedido para integrar uma branch em outra. É o ponto de controle: alguém revisa o diff, o CI roda, e só então acontece o merge. Deixa registrado *quem* mudou *o quê* e *por quê*. | Cada história/correção foi uma branch (`historia/…`, `fix/…`, `docs/…`) integrada por PR — **17 PRs** até aqui (tabela na seção 3). O [modelo de PR](../.github/pull_request_template.md) pede história, evidência de teste e uso de IA; a DoD (README) exige CI verde e aprovação de outra pessoa. |
| **Merge** | Combinar o histórico de duas branches. Quando as duas mudaram partes diferentes, o Git combina sozinho; o resultado é um *merge commit* com dois pais. | O histórico da `main` mostra os merges de cada PR (`git log --merges --oneline main`). |
| **Conflito de merge** | Quando as duas branches alteraram **as mesmas linhas**, o Git não sabe qual versão vale e para, marcando `<<<<<<<` / `=======` / `>>>>>>>`. Uma pessoa precisa decidir. O perigo é resolver "aceitando os dois lados" sem entender o código. | Tivemos conflitos reais em `README.md`, `package.json`, `package-lock.json`, `src/db.js`, `src/app.js` e `src/doacoes.js` (seção 4). Um deles deixou um defeito que o CI **não** pegou (seção 5). |
| **Teste de integração** | Teste que exercita várias partes juntas (rota HTTP → autenticação → regra de negócio → SQL → banco real), em vez de uma função isolada. Pega erros de "encaixe" entre módulos e entre histórias. | Toda a suíte usa `supertest` + PostgreSQL real (ADR 0008). Neste trabalho criamos [`tests/integracao.test.js`](../tests/integracao.test.js) com cenários que **atravessam várias histórias** e vários usuários, e [`scripts/cenarios-integracao.mjs`](../scripts/cenarios-integracao.mjs), que roda os mesmos cenários contra o **sistema no ar** (`npm start`). |

**Por que isso importa para nós:** o Prato Cheio foi construído por cinco pessoas, em branches paralelas,
ao longo de três trabalhos (história zero → H3/H4/H5a → PostgreSQL → H5c → refatoração). Cada história
passava nos próprios testes, mas ninguém tinha verificado **o fluxo inteiro** depois de todos os merges.

---

## 2. Estado da integração (checklist do enunciado)

| Item | Situação | Evidência |
|---|---|---|
| Todas as funcionalidades estão na `main` | ✅ Nenhuma branch remota tem commits fora da `main` | `for b in $(git branch -r); do git rev-list --count origin/main..$b; done` → todas `0` |
| Merges pendentes realizados, conflitos resolvidos | ✅ 17 PRs integrados; conflitos listados na seção 4 | `git log --merges main` |
| Sistema completo rodando com PostgreSQL | ✅ `docker compose up -d` + `npm start` → PostgreSQL 16.15, 2 migrações aplicadas | [`evidencias/banco-postgresql.txt`](evidencias/banco-postgresql.txt), [`evidencias/cenarios-http.md`](evidencias/cenarios-http.md) |
| Testes executados | ✅ **196 testes em 11 arquivos**, cobertura de linhas **99,5%** | [`evidencias/npm-run-ci.txt`](evidencias/npm-run-ci.txt) |
| Lint e formatação | ✅ ESLint e Prettier sem erros | [`evidencias/npm-run-quality.txt`](evidencias/npm-run-quality.txt) |
| Pipeline de CI | ✅ CI, Lint e Prettier verdes no último commit da `main` (`0addc35`) | [CI](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325073) · [Lint](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325181) · [Prettier](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325179) |

---

## 3. Histórico de integração (PRs na `main`)

| PR | Branch | Conteúdo | Data |
|:--:|---|---|---|
| #1 | `historia/ong-aceita-doacao` | ONG aceita doação (história zero) | 18/09 |
| #2 | `ajuste-teste-aceitar-doacao` | Ajuste de teste do aceite | 23/09 |
| #3 | `developers/regra-de-negocio` | Regras de negócio | 23/09 |
| #4 | `docs/diagramas-do-caso` | Diagramas | 07/10 |
| #5 | `historia/doacao-vencida-sai-da-lista` | H5a — vencimento | 08/10 |
| #6, #7 | `dev_DocumentacaoADR` | ADRs | 23/10 |
| #8 | `refactor/testes-e-ci` | Organização dos testes, CI, lint e Prettier | 24/10 |
| #9 | `diagramas-atividade` | Diagramas de atividade | 24/10 |
| #11 | `migrarBD_Julio` | **Migração SQLite → PostgreSQL** (ADR 0001) | 27/10 |
| #12 | `Thomas` | Testes de erro/concorrência, cobertura no CI | 28/10 |
| #13 | `fix/docs` | Correções de links na documentação | 28/10 |
| #14 | `historia/estabelecimento-cancela-doacao` | **H5c** — cancelamento com motivo; migrações versionadas | 04/11 |
| #15 | `test/h5a-criterios-aceite` | Testes dos critérios da H5a | 05/11 |
| #16 | `Thomas` | **Refatoração** (4 melhorias) | 12/11 |
| #17 | `docs/revisao-de-codigo-grupo` | Revisão de código de outra equipe | 12/11 |
| — | `integracao/trabalho-4` | Este trabalho: correção do defeito de merge, testes e evidências de integração | 18/11 |

---

## 4. Conflitos de merge que tivemos

Levantados com `git show --remerge-diff <merge>`, que refaz o merge e mostra onde o Git parou:

| Merge | Branches | Arquivos em conflito | Como foi resolvido |
|---|---|---|---|
| `67dbfd4`, `7c3dee1` | `main` → `migrarBD_Julio` | `README.md`, `package.json`, `package-lock.json` | Mantida a dependência `pg` da migração e as seções novas do README. O lock foi regenerado. |
| `232118f` | idem | `package.json`, `package-lock.json`, `src/db.js` | `db.js` ficou com a versão PostgreSQL (`pg.Pool`), que é a decisão do ADR 0001. |
| `277e3f9` | `main` → `Thomas` | `README.md`, **`src/app.js`**, `src/doacoes.js` | A refatoração (Thomas) tinha convertido as rotas para o helper `responder()`; a `main` tinha recebido as rotas novas da H5c. **A resolução manteve os dois lados** → defeito da seção 5. |

**Lição:** conflitos em `package-lock.json` não se resolvem à mão (rodar `npm install` e versionar o
lock gerado); conflitos em código exigem ler os dois lados e escolher, não somar.

---

## 5. Defeito de integração encontrado e corrigido

**O quê.** Em `src/app.js`, as três rotas da H5c (`GET /api/minhas-doacoes`,
`POST /api/doacoes/:id/cancelar-publicacao`, `GET /api/doacoes/:id/historico`) estavam registradas
**duas vezes**: a versão refatorada (com `responder()`) e, logo abaixo, a versão antiga com
`try/catch`.

**Origem.** Resolução do conflito do merge `277e3f9` (seção 4), confirmada com
`git blame -L 66,120 src/app.js`: as linhas 68–85 vêm de `c6ff04a` (refatoração) e as 87–120 de
`0447ea0` (H5c original).

**Por que o CI não pegou.** O Express usa a **primeira** rota que casa; a cópia nunca era executada.
Comportamento correto, testes verdes, CI verde — mas 35 linhas de código morto que confundem quem lê
(qual handler responde?) e que, numa próxima edição, poderiam ser alteradas "achando" que valem.
**CI verde mostra que o que foi testado funciona; não prova que a integração está limpa.**

**Correção.** Removidas as cópias antigas (`src/app.js`, −35 linhas). Criado um teste de regressão em
[`tests/integracao.test.js`](../tests/integracao.test.js) que percorre o roteador do Express e falha se
houver `método + caminho` repetido.

**Prova de que o teste detecta o defeito.** Rodamos o teste novo contra o `app.js` antigo: ele falha
listando exatamente as três rotas ([`evidencias/regressao-antes-da-correcao.txt`](evidencias/regressao-antes-da-correcao.txt)).
Com a correção, passa ([`evidencias/npm-run-ci.txt`](evidencias/npm-run-ci.txt)).

### Outros ajustes de integração

| Problema | Correção |
|---|---|
| `npm run format:check` falhava em **27 arquivos** no Windows, mas passava no CI. Causa: `core.autocrlf=true` converte LF→CRLF no checkout, e o Prettier exige LF. | [`.gitattributes`](../.gitattributes) com `* text=auto eol=lf`: o mesmo resultado em Windows, Linux e CI. |
| A tela recusava `31/02/2099` com a mensagem *"A validade não pode ser anterior à data de hoje"* (a data não é passada, ela não existe). A validação do navegador e a do servidor tinham evoluído separadamente. | `public/index.html` passou a dar *"A validade deve ser uma data válida."*, a mesma regra do servidor (`src/doacoes.js`). |
| A ONG cancelava a coleta sem poder dizer o porquê, e o cancelamento não entrava no histórico: o estabelecimento via a doação voltar a *disponível* sem explicação (H4b). | Observação opcional ao cancelar a coleta (`POST /api/doacoes/:id/cancelar` com `{ observacao }`), gravada em `historico_doacao` no mesmo comando que muda o status; "Minhas doações" traz `ultimo_historico` e a tela mostra a observação. 10 testes novos em `tests/coletas.test.js`. |
| `npm run lint` analisava o relatório gerado em `coverage/`. | `coverage/**` em `ignores` no [`eslint.config.js`](../eslint.config.js). |
| Arquivo `gitignore` (sem ponto) versionado, cópia idêntica e sem efeito do `.gitignore`; `dados.sqlite` sobrando da era SQLite. | `gitignore` removido; `*.sqlite` no `.gitignore`. |
| `npx vitest` falhava com *"failed to find the runner"* / *"Cannot read properties of undefined (reading 'config')"* no terminal do VS Code no Windows. Causa: o terminal abre em `c:\…` (minúsculo) e o Vitest carrega o módulo duas vezes (`c:` ≠ `C:`). | Não é defeito do projeto. Abrir o terminal em `C:\…` (`cd C:\Users\...`) resolve. Registrado aqui para o próximo integrante. |

---

## 6. Como reproduzir tudo

```bash
docker compose up -d                 # PostgreSQL 16 (+ banco pratocheio_test)
cp .env.example .env
npm install
npm run ci                           # 196 testes + cobertura (banco pratocheio_test)
npm run quality                      # ESLint + Prettier
npx vitest run tests/integracao.test.js   # só os cenários de integração

npm start                            # em outro terminal: sistema completo em http://localhost:3001
node scripts/cenarios-integracao.mjs # cenários via HTTP real; imprime esperado × obtido
```
