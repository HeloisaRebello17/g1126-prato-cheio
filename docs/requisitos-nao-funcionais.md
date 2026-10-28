# Requisitos não funcionais — Prato Cheio

Este documento identifica **três requisitos não funcionais (RNF)**, explica **como cada um afetou as
decisões de projeto** e mostra **como verificar** que foi atendido. Os requisitos foram derivados das
restrições, stakeholders e riscos de [`analise.md`](analise.md); o detalhamento original está em
[`projeto.md`](projeto.md#requisitos-não-funcionais).

## 1. Visão geral

| # | Requisito | Categoria (ISO/IEC 25010) | Origem na Análise | Decisões que motivou | Situação |
|---|---|---|---|---|---|
| RNF1 | Uso em celular com internet instável | Eficiência de desempenho · Usabilidade | Restrição *mobile web*; stakeholder *Voluntário de coleta*; risco *conexão instável trava o uso* | ADR [0005](adr/0005-expiracao-sob-demanda-e-polling.md), [0007](adr/0007-arquitetura-em-camadas-e-front-end-estatico.md) | Atendido na medição da equipe; teste em celular real pendente |
| RNF2 | Consistência no aceite de doações | Confiabilidade · Integridade | Regra *doação aceita some para as outras*; critério H1 | ADR [0004](adr/0004-aceite-concorrente-com-update-condicional.md) | Atendido e testado, inclusive com requisições simultâneas |
| RNF3 | Custo zero e portabilidade do banco | Portabilidade · Manutenibilidade | Restrições *orçamento zero*, *equipe pequena*, *poucas semanas*; exigência de PostgreSQL | ADR [0001](adr/0001-migracao-sqlite-para-postgresql.md), [0007](adr/0007-arquitetura-em-camadas-e-front-end-estatico.md) | Atendido: migração concluída, suíte passa no PostgreSQL |

Cada requisito é descrito por um **cenário de qualidade** (fonte → estímulo → ambiente → artefato →
resposta → medida), para que seja verificável e não apenas um desejo.

---

## 2. RNF1 — Uso em celular com internet instável

**Descrição.** O sistema é usado no navegador do celular, sem instalar aplicativo, e deve continuar
utilizável em rede móvel lenta ou que oscila (situação de quem faz a coleta na rua).

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | ONG ou voluntário usando o celular |
| Estímulo | Abre a lista de doações e aceita uma |
| Ambiente | Rede móvel lenta (perfil "Slow 3G") |
| Artefato | `public/index.html` + API `/api/doacoes` |
| Resposta | A lista aparece e o aceite é confirmado; se a rede falhar, o usuário vê uma mensagem de erro, não uma tela travada |
| Medida | Página inicial ≤ 50 KB; lista visível em ≤ 3 s; aceite em ≤ 2 s |

**Impacto nas decisões de projeto.**

| Decisão | Como o RNF1 pesou | Alternativa descartada |
|---|---|---|
| Front-end em HTML, CSS e JS puros, servido pelo Express | Página leve, sem build e sem biblioteca carregada da internet | SPA com React/Vue: mais download e complexidade para uma tela só |
| Atualização da lista por **polling** (30 s) | Cada atualização é uma requisição independente e funciona quando a conexão cai e volta | Push/e-mail: exige serviço externo e conexão estável |
| **Expiração sob demanda** (marcar `vencida` ao listar/aceitar) | Nenhum processo em segundo plano nem infraestrutura extra | Job agendado |
| API com erros padronizados (`400/401/403` + `{ erro }`) | A interface sempre consegue mostrar uma mensagem clara | — |

**Trade-offs.** O polling gera requisições sem novidade (aceitável no piloto; o intervalo é ajustável).
Uma doação vencida que ninguém consulta continua `disponivel` no banco até a próxima listagem.

**Como verificar.**
- Medição registrada pela equipe em [`validacao.md`](validacao.md): com latência de 400 ms e 50 KB/s, a
  tela de login carregou em 491 ms, transferiu 3.122 bytes e fez 2 requisições (dentro das metas).
- **Não verificado ainda:** o aceite em rede móvel real, num celular. Repetir a medição com o DevTools em
  "Slow 3G" e num aparelho de um integrante.
- Respostas de erro da API: `tests/erros-api.test.js`.

---

## 3. RNF2 — Consistência no aceite de doações

**Descrição.** Uma doação só pode ser aceita por **uma** ONG. Depois de aceita, não pode aparecer nem ser
aceita por outra, mesmo que duas ONGs tentem ao mesmo tempo.

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | Duas ou mais ONGs |
| Estímulo | Enviam `POST /api/doacoes/:id/aceitar` para a mesma doação quase ao mesmo tempo |
| Ambiente | Operação normal, conexões concorrentes ao PostgreSQL |
| Artefato | `doacoes.aceitar` + `repositorio.aceitar` + banco |
| Resposta | Exatamente uma recebe `200` (status `aceita`); as demais recebem `400 — "doação já foi aceita"` |
| Medida | 0 doações com mais de uma ONG; 100% das tentativas duplicadas recusadas |

**Impacto nas decisões de projeto.**

| Decisão | Como o RNF2 pesou | Alternativa descartada |
|---|---|---|
| Aceite por **UPDATE condicional** (`... WHERE id = ? AND status = 'disponivel' RETURNING *`) | Checagem e gravação numa única instrução atômica: não há janela entre "ler" e "gravar" | Lock pessimista (`SELECT ... FOR UPDATE`): exige transação, trata timeout e perde desempenho sob disputa |
| O **banco** é a fonte da verdade do `status` | A interface nunca decide sozinha se a doação está disponível | Aceite "offline": conflita com RNF1 |
| Regra em `doacoes.js`, garantia atômica em `repositorio.js` | Separa "o que é permitido" de "como não corromper dados" | — |
| Nome da ONG vem da **sessão**, não do corpo da requisição | Impede que uma ONG aceite em nome de outra | — |

**Tensão com RNF1.** Rede ruim pediria aceite offline, mas a consistência exige confirmação do servidor.
Prevaleceu o RNF2: o aceite sempre passa pelo servidor e a interface mostra erro claro se a rede falhar.

**Como verificar.**
- `tests/concorrencia.test.js`: 10 ONGs disputam a mesma doação (1 vence, 9 recusadas); 3 doações aceitas
  em paralelo sem interferência; aceite e cancelamento simultâneos terminam num estado consistente.
- `tests/coletas.test.js`: duas ONGs simultâneas e recusa de aceite repetido.
- `tests/db.test.js`: `repositorio.aceitar` só altera doação `disponivel`.
- Prova de eficácia: remover `AND status = 'disponivel'` do SQL faz 2 testes falharem.

---

## 4. RNF3 — Custo zero e portabilidade do banco

**Descrição.** O sistema deve funcionar sem custo de infraestrutura e permitir trocar o banco (SQLite →
PostgreSQL) sem reescrever regras de negócio nem rotas.

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | Equipe de desenvolvimento |
| Estímulo | Substituir o SQLite pelo PostgreSQL |
| Ambiente | Unidade 3, com a suíte de testes existente |
| Artefato | `src/db.js` (e o SQL de `src/repositorio.js`) |
| Resposta | A troca fica contida na camada de dados; regras, rotas e interface não mudam |
| Medida | Custo mensal = R$ 0; `app.js` sem alteração; os mesmos testes passando antes e depois; CI verde com serviço PostgreSQL |

**Impacto nas decisões de projeto.**

| Decisão | Como o RNF3 pesou | Alternativa descartada |
|---|---|---|
| **PostgreSQL em contêiner Docker local** (ADR 0001) | Custo zero; ambiente igual para o grupo e para o CI (`postgres:16-alpine`); banco descartável | Serviço gerenciado gratuito (Neon/Supabase/Render): limites do plano, dependência de internet, testes apagariam dados dos colegas |
| **Arquitetura em camadas** (`app` → `doacoes` → `repositorio` → `db`) | Só `db.js` sabe qual banco existe; interface única `query(sql, valores)` → `{ rows }` | Acessar o banco direto das rotas |
| SQL com marcador `?` convertido para `$n` em `db.js` | `repositorio.js` não mudou na migração | SQL específico do PostgreSQL espalhado pelo código |
| `validade` continua `TEXT dd/mm/aaaa` | A migração fica só "troca de banco", sem mudar o contrato da API | Trocar para `DATE` na mesma entrega (fica para refatoração própria) |
| Banco de testes **separado** (`pratocheio_test`) | `limparBanco()` apaga os dados; nunca pode atingir o banco de desenvolvimento | Mesmo banco para tudo |

**Trade-offs.** Cada integrante precisa de Docker; o servidor não sobe sem `DATABASE_URL`; `validade` ainda
não pode ser comparada no SQL.

**Como verificar.**
- `npm test` roda a suíte inteira contra o PostgreSQL (`pratocheio_test`); o CI faz o mesmo num service
  container.
- `tests/db.test.js`: idempotência de `migrar()`, tabelas criadas, `limparBanco()` reinicia ids,
  restrições `UNIQUE`, `CHECK` e `NOT NULL`.
- Evidência da migração (11 testes antes, 12 depois) em [`refatoracoes.md`](refatoracoes.md). O link do CI
  verde dessa execução ainda precisa ser preenchido depois de abrir o PR.

---

## 5. Tensões entre os requisitos

| Conflito | Como foi resolvido |
|---|---|
| RNF1 × RNF2: rede ruim pediria aceite offline; consistência exige o servidor | Prioriza RNF2; a interface mostra erro claro se a rede falhar |
| RNF1 × RNF3: polling gera mais requisições ao banco | Volume do piloto é baixo; intervalo ajustável |
| RNF2 × RNF3: lock pessimista seria mais "forte", mas menos simples e portável | Verificação otimista atende a regra e é simples de testar |

## 6. Limitações conhecidas

- Sem teste automatizado da interface; o RNF1 depende de medição manual.
- Sessões em memória (ADR 0006): reiniciar o servidor desloga todos e não há mais de uma instância.
- Nenhum requisito de segurança (limite de tentativas de login, expiração de token) foi formalizado como RNF
  nesta entrega.
