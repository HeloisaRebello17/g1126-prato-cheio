# Validação - Prato Cheio

*Trabalho 3, revisado no Trabalho 4 (integração) · confronto do produto **integrado na `main`** com os
critérios de aceite escritos na Unidade 1 ([`analise.md`](analise.md#critérios-de-aceite-exemplos))*

Legenda: ✅ atende · 🟡 atende parcialmente · ❌ não atende

Todas as evidências abaixo foram geradas sobre o código integrado (todas as branches mergeadas), rodando
contra **PostgreSQL 16**. Como o processo de integração foi feito está em [`integracao.md`](integracao.md).

## 1. Critérios de aceite da Unidade 1

| # | Critério (texto da Unidade 1) | Resultado | Evidência | Observação |
|:--:|---|:--:|---|---|
| H1a | *"…quando salva a publicação, então tipo, quantidade e janela de retirada devem estar preenchidos"* | 🟡 | `tests/doacoes.test.js`, `tests/doacoes-regras.test.js`; Cenário 3 abaixo (data inexistente, data passada, quantidade negativa → `400`) | Tipo e quantidade: atende. A **janela de retirada** foi simplificada para uma **data de validade** (`dd/mm/aaaa`): não há horário de início/fim de retirada. |
| H1b | *"…quando uma ONG a aceita, ela deixa de aparecer para as demais ONGs"* | ✅ | Cenário 1 (ONG B não vê e recebe `400 doação já foi aceita`); `tests/concorrencia.test.js` (10 ONGs disputam, só 1 vence) | Garantido no banco por `UPDATE … WHERE status = 'disponivel'` (ADR 0004). |
| H3 | *"…quando a ONG aplica um filtro por tipo, então ela vê somente doações do tipo escolhido"* | ✅ | Cenário 1 (filtro `arr` → só o arroz); `tests/doacoes.test.js` | O filtro é por "contém" sem diferenciar maiúsculas. Limitação: **não ignora acento** (`feijao` não encontra `Feijão`), e o tipo é texto livre (não há lista fixa de tipos). |
| H4a | *"…a doação volta a ficar disponível"* (ONG cancela a coleta) | ✅ | Cenário 1 (ONG A cancela → arroz volta → ONG B aceita); `tests/coletas.test.js` | Só a ONG dona da coleta consegue cancelar (`tests/doacoes-regras.test.js`). |
| H4b | *"…dentro do prazo de validade"* e *"…o estabelecimento é notificado"* | 🟡 | Cenário 1 (ONG cancela com observação → histórico `aceita → disponivel` com a observação → estabelecimento a vê em "Minhas doações"); `tests/coletas.test.js` (observação opcional, inválida, recusada sem gravar histórico) | Ao cancelar, a ONG pode deixar uma **observação** (opcional, até 500 caracteres), gravada no histórico; o estabelecimento vê *"A ONG cancelou a coleta. Observação: …"* em "Minhas doações". **Não há notificação ativa** (e-mail/push): ele só vê ao abrir ou atualizar a tela. Também não há bloqueio específico para cancelar após a validade (a doação vencida simplesmente não é mais aceita por ninguém). |
| H5a | *"vencimento expira → status 'vencida'"* | ✅ | Cenário 3 (doação vencida não aparece e o aceite responde `400 doação vencida`); `tests/doacoes.test.js` | Expiração sob demanda, ao listar ou aceitar (ADR 0005); não há rotina agendada. |
| H5b | *"ONG não comparece → volta a ficar disponível"* | ❌ | — | Não implementado de forma automática: não existe prazo de retirada nem confirmação de coleta. **Contorno:** o estabelecimento cancela com motivo (H5c), mas a doação vai para *cancelada*, não volta para *disponível*. |
| H5c | *"cancelamento manual → motivo registrado no histórico"* | ✅ | Cenário 2 (motivo obrigatório, some das coletas da ONG, ONG não aceita de novo, histórico guarda o motivo); `tests/cancelamento-doador.test.js` | Só o estabelecimento que publicou cancela/vê o histórico (outro doador recebe `404`). |
| — | H2 (*ONG publica necessidade*) | fora do escopo | [`analise.md`](analise.md#decisão-de-análise) | Retirada do piloto na Unidade 1, por decisão registrada. |

### Critérios incorporados depois da Unidade 1

| Critério | Resultado | Evidência | Observação |
|---|:--:|---|---|
| Cadastro e login de doador e ONG; cada perfil só faz o que lhe cabe | ✅ | Cenário 3 (ONG publicando → `403`, sem token → `401`, senha errada → `401`); `tests/auth.test.js`, `tests/erros-api.test.js` | Sessões em memória e token sem expiração: reiniciar o servidor desloga todos (ADR 0006). |
| Lista da ONG atualiza sozinha (polling de 30 s) | ✅ | `public/index.html` (`setInterval` de 30 000 ms); verificado manualmente na demo | **Sem teste automatizado** de interface. |
| RNF1 — leve em celular com rede instável | ✅ | Medição manual: rede lenta simulada (400 ms, 50 KB/s) → login em 491 ms, 3.122 bytes, 2 requisições | Meta: ≤ 50 KB e ≤ 3 s. Não medido em celular real. |
| RNF2 — consistência no aceite concorrente | ✅ | `tests/concorrencia.test.js`; Cenário 1 | — |
| RNF3 — banco gratuito e portátil (PostgreSQL) | ✅ | [`evidencias/banco-postgresql.txt`](evidencias/banco-postgresql.txt) (PostgreSQL 16.15, migrações 1 e 2 aplicadas); CI com `postgres:16-alpine` | — |

**Resumo:** 5 ✅ · 2 🟡 · 1 ❌ entre os critérios da Unidade 1 (H2 fora do escopo).

---

## 2. Cenários de integração

Cada cenário envolve **mais de uma história** e **mais de um usuário** sobre os mesmos dados, passando
por todas as camadas (HTTP → autenticação → regra → repositório → PostgreSQL). Foram executados de
duas formas:

- **Automatizada** — [`tests/integracao.test.js`](../tests/integracao.test.js) (supertest + banco
  `pratocheio_test`), parte do `npm run ci` e do CI do GitHub.
- **Sistema no ar** — [`scripts/cenarios-integracao.mjs`](../scripts/cenarios-integracao.mjs) contra
  `npm start` + PostgreSQL do `docker compose`. Saída completa, passo a passo, em
  [`evidencias/cenarios-http.md`](evidencias/cenarios-http.md).

### Cenário 1 — publicar → filtrar → aceitar → ONG cancela com observação → outra ONG aceita

*Histórias:* H1 + H3 + H4 + autenticação · *Atores:* 1 estabelecimento, 2 ONGs

| Passo | Esperado | Obtido |
|---|---|---|
| Estabelecimento publica Arroz e Feijão | `201`, status `disponivel` | `201`, `disponivel` ✅ |
| ONG A filtra por "Arroz" | só o arroz | só o arroz (`id 1`) ✅ |
| ONG A aceita o arroz | `200`, status `aceita`, `ong = ONG A` | idem ✅ |
| ONG B lista e tenta aceitar o arroz | não vê; `400 doação já foi aceita` | lista vazia; `400 doação já foi aceita` ✅ |
| ONG A cancela a coleta com a observação "Sem veículo para buscar hoje" | `200`, volta a `disponivel`, sai de "minhas coletas" | idem ✅ |
| Estabelecimento consulta "Minhas doações" e o histórico | arroz `disponivel`, último registro `aceita → disponivel` com a observação | idem ✅ |
| ONG B aceita | `200`, `ong = ONG B` | idem ✅ |
| Estabelecimento consulta "Minhas doações" | arroz `aceita`, feijão `disponivel` | idem ✅ |
| Banco | uma linha, um dono | `1 | aceita | ONG B` ([banco](evidencias/banco-postgresql.txt)) ✅ |

### Cenário 2 — estabelecimento cancela uma doação já aceita, com motivo

*Histórias:* H1 + H5c + controle de acesso · *Atores:* 2 estabelecimentos, 1 ONG

| Passo | Esperado | Obtido |
|---|---|---|
| Publica Pão; ONG A aceita | `201`; `200` | ✅ |
| Cancela com motivo em branco | `400 motivo do cancelamento é obrigatório`, nada muda | idem ✅ |
| Cancela com motivo "ONG não apareceu para retirar" | `200`, status `cancelada` | idem ✅ |
| ONG A consulta coletas e tenta aceitar de novo | pão sumiu; `400 doação cancelada pelo estabelecimento` | idem ✅ |
| Estabelecimento consulta o histórico | `aceita → cancelada` com o motivo | idem ✅ |
| Outro estabelecimento consulta o histórico | `404` | `404` ✅ (teste automatizado) |

### Cenário 3 (erro) — entradas inválidas e acessos indevidos não alteram o banco

*Histórias:* H1 + H5a + autenticação

| Passo | Esperado | Obtido |
|---|---|---|
| Publicar com validade `31/02/2099` | `400 validade deve ser uma data válida` | idem ✅ |
| Publicar com validade de ontem | `400 validade não pode ser anterior à data de hoje` | idem ✅ |
| Publicar com quantidade `-3` | `400 quantidade deve ser um número positivo` | idem ✅ |
| ONG tenta publicar | `403 perfil sem permissão` | idem ✅ |
| Listar sem token | `401 autenticação necessária` | idem ✅ |
| Login com senha errada | `401 E-mail ou senha inválidos` | idem ✅ |
| Contagem de doações antes × depois | igual (nada gravado) | igual ✅ |
| Doação vencida | não aparece; aceite → `400 doação vencida`; status `vencida`, sem ONG | idem ✅ (teste automatizado) |

### Regressão do merge

Um quarto teste verifica que **nenhuma rota é registrada duas vezes** — o defeito que encontramos ao
integrar (ver [`integracao.md` §5](integracao.md#5-defeito-de-integração-encontrado-e-corrigido)).
Rodando contra o código anterior à correção, ele falha apontando as 3 rotas duplicadas
([evidência](evidencias/regressao-antes-da-correcao.txt)); com a correção, passa.

---

## 3. Evidências

| Evidência | O que prova |
|---|---|
| [`evidencias/npm-run-ci.txt`](evidencias/npm-run-ci.txt) | 196 testes, 11 arquivos, todos aprovados; cobertura ≥ limites do `vitest.config.js` |
| [`evidencias/npm-run-quality.txt`](evidencias/npm-run-quality.txt) | ESLint e Prettier sem erros |
| [`evidencias/cenarios-http.md`](evidencias/cenarios-http.md) | Os 3 cenários executados no sistema no ar, com status esperado × obtido de cada requisição |
| [`evidencias/banco-postgresql.txt`](evidencias/banco-postgresql.txt) | Versão do PostgreSQL, migrações aplicadas e estado final das doações/histórico após os cenários |
| [`evidencias/regressao-antes-da-correcao.txt`](evidencias/regressao-antes-da-correcao.txt) | O teste de regressão detecta o defeito de merge |
| GitHub Actions na `main` (`0addc35`): [CI](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325073), [Lint](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325181), [Prettier](https://github.com/HeloisaRebello17/g1126-prato-cheio/actions/runs/43330325179) | Pipeline verde no último merge |

## 4. Limitações conhecidas

- Sem notificação ativa ao estabelecimento (H4b): a observação da ONG só aparece quando ele abre ou atualiza a tela. Sem retorno automático por não comparecimento (H5b).
- "Janela de retirada" reduzida a uma data de validade (H1a).
- Filtro por tipo não ignora acentos; tipo é texto livre.
- O histórico registra os cancelamentos (pela ONG e pelo estabelecimento); o aceite e o vencimento ainda não.
- Sessões em memória, sem expiração (ADR 0006).
- Interface sem testes automatizados; polling e RNF1 verificados manualmente.

## Mudanças de critério ao longo do semestre

O cadastro e o login foram incorporados ao fluxo para identificar o perfil de cada usuário. A seleção
manual de perfil foi removida da interface: o usuário autenticado acessa somente as operações
permitidas ao seu perfil. Na revisão do Trabalho 4, H1 e H4 foram divididos em sub-critérios (a/b) para
separar o que atende do que não atende, em vez de marcar a história inteira como "sim".

## Uso de IA

Na construção, a IA auxiliou no filtro por tipo, cancelamento de coleta, polling, autenticação e testes;
para provar que os testes detectam defeitos, foram injetados 6 defeitos no código e a suíte falhou em
todos. No Trabalho 4, a IA ajudou a levantar os conflitos de merge do histórico, encontrou as rotas
duplicadas, escreveu `tests/integracao.test.js` e o script de cenários HTTP. A equipe conferiu
executando a suíte, rodando o teste de regressão contra o código antigo (falhou como esperado) e
revisando o veredito de cada critério — inclusive rebaixando H1, H4 e H5b, antes marcados como "sim".
Durante a validação, a equipe notou que a ONG não tinha onde explicar por que cancelou a coleta; a
observação opcional foi implementada (com testes) e H4b passou de ❌ para 🟡.
