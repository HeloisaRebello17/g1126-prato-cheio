# Documento de Projeto — Prato Cheio

*Trabalho 2 · máximo 4 páginas (fora diagramas) · entrega na Aula 10*

## Decisões de projeto
| # | Decisão | Alternativas | Requisito/risco da Análise que a motiva |
|---|---|---|---|
| **1** | Onde/como rodar o PostgreSQL na Unidade 3 | **A)** Contêiner Docker local, controlado pela equipe.<br>**B)** Serviço gerenciado gratuito (Neon/Supabase/Render). | Restrição de negócio "**orçamento zero**" e a exigência do README de banco relacional acessível por `DATABASE_URL` com CI verde. |
| **2** | Como evitar que duas ONGs aceitem a mesma doação ao mesmo tempo | **A)** Verificação otimista: `UPDATE ... WHERE status = 'disponivel'` e checar se alguma linha foi afetada.<br>**B)** Lock pessimista: `SELECT ... FOR UPDATE` na linha da doação dentro de uma transação antes de aceitar. | Regra de negócio "**doação aceita por uma ONG some para as outras**" e o critério de aceite H1 ("quando uma ONG a aceita, ela deixa de aparecer para as demais ONGs"). |
| **3** | Como avisar as ONGs sobre novas doações e tratar a expiração | **A)** Polling: front-end atualiza a lista periodicamente (refresh curto), sem infraestrutura extra.<br>**B)** Notificação (e-mail/push) no momento da publicação + job agendado que marca doações vencidas como "vencida". | Risco "**doação perdida por atraso na coleta**" (prob. alta, impacto alto, mitigação "notificação imediata + contagem regressiva") e a incerteza sobre se as ONGs checariam a ferramenta sem o "empurrão" do WhatsApp. |

## Tabela de trade-offs (uma decisão em detalhe)
Decisão detalhada: **#2 — como evitar que duas ONGs aceitem a mesma doação ao mesmo tempo.**

| Critério | A) Verificação otimista (UPDATE condicional) | B) Lock pessimista (`SELECT ... FOR UPDATE`) |
|---|---|---|
| Evita condição de corrida | Sim, se o `UPDATE` checar `status` e a aplicação validar `rowCount` | Sim, a linha fica bloqueada até o fim da transação |
| Complexidade de implementação | Baixa — um `UPDATE` com `WHERE` e checagem do retorno | Média — exige transação explícita e tratamento de deadlock/timeout |
| Desempenho sob concorrência | Alto — sem bloqueio, poucas doações disputadas no piloto | Menor — outras ONGs esperam a transação liberar a linha |
| Compatibilidade SQLite → PostgreSQL | Direta — `WHERE status = 'disponivel'` funciona igual nos dois | `FOR UPDATE` não existe no SQLite; exigiria adaptação na troca de banco (U3) |
| Facilidade de teste | Alta — basta simular dois `UPDATE`s e checar o segundo | Mais difícil — exige simular transações concorrentes reais |
| **Escolha** | **Selecionada** — atende a regra de negócio sem custo extra e não quebra ao trocar para PostgreSQL | Descartada para o piloto; reconsiderar se o volume de disputas pela mesma doação crescer |

## Diagramas
Ver [`docs/diagramas.md`](diagramas.md): contexto, fluxo principal com pontos de falha, estados da doação,
componentes e modelo de dados — este último confrontado com o schema real de `src/db.js`.

## ADRs
Registro completo em [`docs/adr/`](adr/):

| ADR | Decisão | Origem |
|---|---|---|
| [0001](adr/0001-migracao-sqlite-para-postgresql.md) | Migração de SQLite para PostgreSQL em contêiner Docker | Decisão #1, RNF3 |
| [0002](adr/0002-adotar-vitest.md) | Vitest como executor de testes | RNF3 |
| [0003](adr/0003-reavaliacao-vitest-multicidades.md) | Reavaliação do Vitest com expansão multicidades (mantido) | — |
| [0004](adr/0004-aceite-concorrente-com-update-condicional.md) | Aceite com UPDATE condicional (otimista) | Decisão #2, RNF2 |
| [0005](adr/0005-expiracao-sob-demanda-e-polling.md) | Expiração sob demanda e polling | Decisão #3, RNF1, H5a |
| [0006](adr/0006-autenticacao-propria-scrypt-e-sessoes-em-memoria.md) | Autenticação própria (scrypt, sessões em memória) | Critério 4 |
| [0007](adr/0007-arquitetura-em-camadas-e-front-end-estatico.md) | Camadas e front-end estático | RNF1, RNF3 |
| [0008](adr/0008-estrategia-de-testes-e-pipeline.md) | Testes com PostgreSQL real, casos de erro e cobertura no CI | RNF2, RNF3 |

## Requisitos não-funcionais

Os requisitos abaixo foram derivados das restrições, stakeholders e riscos registrados em
`docs/analise.md`. Cada um é descrito por um **cenário de qualidade** (fonte → estímulo → ambiente →
resposta → medida), para que seja verificável, e ligado às decisões de projeto que ele motivou.

### Visão geral

| # | Requisito | Categoria (ISO/IEC 25010) | Decisões afetadas | Situação atual |
|---|---|---|---|---|
| RNF1 | Uso em celular com internet instável | Eficiência de desempenho · Usabilidade | #3 (aviso e expiração), interface | Parcial: interface leve existe; desempenho ainda não medido |
| RNF2 | Consistência no aceite de doações | Confiabilidade · Integridade | #2 (concorrência) | Atendido e testado (sequencial e com 10 requisições simultâneas) |
| RNF3 | Custo zero e portabilidade do banco | Portabilidade · Manutenibilidade | #1 (PostgreSQL), arquitetura em camadas | Atendido: migração concluída ([ADR 0001](adr/0001-migracao-sqlite-para-postgresql.md)); suíte passa no PostgreSQL |

---

### RNF1 — Uso em celular com internet instável

**Descrição.** O Prato Cheio deve ser usado pelo navegador do celular, sem instalar aplicativo, e
continuar utilizável em rede móvel lenta ou que oscila — situação comum de quem está na rua fazendo
a coleta.

**Origem na Análise.**
- Restrição de negócio: *mobile web*.
- Stakeholder *Voluntário de coleta*: espera que "funcione com internet ruim".
- Risco *Conexão instável trava o uso* (probabilidade média, impacto médio), com mitigação
  "interface leve, mobile-first".

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | ONG ou voluntário usando o celular |
| Estímulo | Abre a lista de doações e aceita uma |
| Ambiente | Rede móvel lenta (perfil "Slow 3G" do DevTools do navegador) |
| Artefato | `public/index.html` + API `/api/doacoes` |
| Resposta | A lista aparece e o aceite é confirmado; se a rede falhar, o usuário vê uma mensagem de erro em vez de uma tela travada |
| Medida (meta) | Página inicial ≤ 50 KB transferidos; lista visível em ≤ 3 s; resposta do aceite em ≤ 2 s |

**Impacto nas decisões de projeto.**
- **Interface:** página única em HTML, CSS e JavaScript puros (`public/index.html`, ~11 KB), sem
  framework, sem etapa de build e sem bibliotecas externas carregadas da internet. Usa
  `meta viewport` para se ajustar à tela do celular. Descartamos um framework SPA (React, Vue)
  porque aumentaria o tamanho do download e a complexidade sem ganho para uma tela única.
- **API:** REST com respostas JSON pequenas (apenas os campos da doação) e erros padronizados
  (`400` + `{ erro }`), que a interface mostra ao usuário em `mostrarErro`.
- **Decisão #3 (aviso de novas doações):** o RNF1 favorece a alternativa **A — polling**. Ele
  funciona mesmo quando a conexão cai e volta, porque cada atualização é uma requisição
  independente. A alternativa B (push/e-mail) exigiria serviço externo e conexão estável para
  entregar o aviso.
- **Expiração "preguiçosa" (H5a):** a doação vencida é marcada no momento de listar ou aceitar,
  em `doacoes.js`, sem job em segundo plano. Assim não há processo extra no servidor nem
  infraestrutura adicional.

**Trade-offs e riscos.**
- O polling gera requisições repetidas mesmo sem novidade. Com poucos usuários no piloto, isso é aceitável. Se o volume crescer, o intervalo precisa ser ajustado.
- Com a expiração preguiçosa, uma doação vencida que ninguém consulta continua `disponivel` no banco até a próxima listagem (já registrado em `docs/diagramas.md`).
- A lista de doações e as coletas da ONG são recarregadas automaticamente a cada 30 segundos enquanto o perfil de ONG está ativo. O polling usa requisições independentes e é interrompido quando o usuário sai ou quando o perfil é de doador.

**Como verificar.** Abrir a aplicação no DevTools com o perfil "Slow 3G" e registrar o tamanho
transferido e o tempo até a lista aparecer. Repetir no celular real de um integrante usando os
dados móveis.

---

### RNF2 — Consistência no aceite de doações

**Descrição.** Uma doação só pode ser aceita por **uma** ONG. Depois de aceita, ela não pode
aparecer nem ser aceita por outra, mesmo que duas ONGs tentem ao mesmo tempo.

**Origem na Análise.**
- Regra de negócio: *doação aceita por uma ONG some para as outras*.
- Critério de aceite H1: "quando uma ONG a aceita, ela deixa de aparecer para as demais ONGs".
- Problema central: a coordenação por WhatsApp gera conflito sobre "quem vai buscar". O sistema só
  resolve esse problema se o aceite for confiável.

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | Duas ONGs diferentes |
| Estímulo | Ambas enviam `POST /api/doacoes/:id/aceitar` para a mesma doação |
| Ambiente | Operação normal, com requisições quase simultâneas |
| Artefato | `doacoes.aceitar` + `repositorio.aceitar` + banco |
| Resposta | Exatamente uma recebe `200` com status `aceita`; a outra recebe `400 — "doação já foi aceita"` |
| Medida | 0 doações com mais de uma ONG; 100% das tentativas duplicadas recusadas |

**Impacto nas decisões de projeto.**
- **Decisão #2:** escolhemos a **verificação otimista** — `UPDATE doacoes SET status = 'aceita',
  ong = ? WHERE id = ? AND status = 'disponivel' RETURNING *`. Se nenhuma linha volta, a doação
  já foi aceita e a aplicação recusa. A checagem e a gravação acontecem em **uma única instrução
  atômica**, então não existe janela entre "ler o status" e "gravar o aceite".
- **Alternativa descartada:** lock pessimista (`SELECT ... FOR UPDATE`). Ela também garante a
  consistência, mas exige transação explícita e tratamento de timeout. Além disso, não existe no
  SQLite, o que quebraria a compatibilidade com a migração (RNF3).
- **Fonte da verdade no banco:** o campo `status` decide se a doação está disponível. A interface
  nunca decide isso sozinha; por isso não há aceite "offline" — trade-off consciente com o RNF1.
- **Separação de responsabilidades:** a regra ("não aceitar se não estiver disponível; não aceitar
  se vencida") fica em `doacoes.js`, e a garantia atômica fica no SQL de `repositorio.js`.

**Trade-offs e riscos.**
- A ONG que perde a disputa precisa recarregar a lista e escolher outra doação. Isso é aceitável,
  porque o erro é claro e imediato.
- Além do teste sequencial, `tests/concorrencia.test.js` dispara as requisições **em paralelo**
  (`Promise.all`) contra o PostgreSQL real: duas ONGs em `tests/coletas.test.js` e dez ONGs em
  `tests/concorrencia.test.js`; em todos os casos exatamente uma vence. Remover o
  `AND status = 'disponivel'` do SQL faz esses testes falharem (verificado por mutação).

**Como verificar.** `npm test` (testes em `tests/coletas.test.js` e `tests/concorrencia.test.js`),
executado no CI a cada Pull Request e a cada push na `main`. Decisão registrada no
[ADR 0004](adr/0004-aceite-concorrente-com-update-condicional.md).

---

### RNF3 — Custo zero e portabilidade do banco

**Descrição.** O sistema deve funcionar sem custo de infraestrutura e permitir trocar o banco
(SQLite → PostgreSQL) sem reescrever as regras de negócio nem as rotas.

**Origem na Análise.**
- Restrições: *orçamento zero*, *equipe pequena*, *poucas semanas*.
- Exigência da disciplina: banco relacional migrado para PostgreSQL na Unidade 3, acessível por
  `DATABASE_URL`, com CI verde.

**Cenário de qualidade.**

| Elemento | Valor |
|---|---|
| Fonte | Equipe de desenvolvimento |
| Estímulo | Substituir o SQLite pelo PostgreSQL |
| Ambiente | Unidade 3, com a suíte de testes existente |
| Artefato | `src/db.js` (e o SQL de `src/repositorio.js`) |
| Resposta | A troca fica contida na camada de dados; regras, rotas e interface não mudam |
| Medida | Custo mensal de infraestrutura = R$ 0; `doacoes.js` e `app.js` sem alteração; os mesmos testes passando antes e depois (11 antes; 12 depois, com um teste novo para id inválido — ver `docs/refatoracoes.md`); CI verde com serviço PostgreSQL |

**Impacto nas decisões de projeto.**
- **Arquitetura em camadas:** `app.js` (rotas) → `doacoes.js` (regras) → `repositorio.js` (SQL) →
  `db.js` (conexão). Só `db.js` sabe qual banco está em uso e expõe uma interface única,
  `query(sql, valores)` → `{ rows }`.
- **Unidades 1 e 2:** SQLite embutido no Node (`node:sqlite`). Não há nada para instalar nem custo,
  e os testes usam banco em memória.
- **Decisão #1 (onde rodar o PostgreSQL):** as duas alternativas consideradas — contêiner Docker
  local ou serviço gerenciado gratuito (Neon/Supabase/Render) — respeitam o custo zero. A conexão é
  configurada apenas por `DATABASE_URL`, então trocar de uma para a outra não muda o código.
- **SQL portável:** marcador `?` no repositório, convertido para `$1, $2…` dentro do `db.js` na
  versão PostgreSQL; nenhum recurso exclusivo de um banco nas regras. Os pontos não portáveis
  ficam isolados no schema (`AUTOINCREMENT` → `SERIAL`, `datetime('now')` → `now()`).
- **Testes como rede de segurança:** a mesma suíte roda antes e depois da troca e prova que o
  comportamento se manteve (evidência exigida em `docs/refatoracoes.md`).

**Trade-offs e riscos.**
- Serviços gratuitos têm limites de armazenamento e conexões, e podem suspender bancos inativos.
- O Docker local exige que cada integrante tenha o Docker instalado.
- A coluna `validade` continua como texto `dd/mm/aaaa` para não mudar o comportamento na migração.
  Convertê-la para `DATE` fica como refatoração separada.

**Como verificar.** Na branch de migração: rodar `npm test` contra o PostgreSQL, conferir pelo
diff que `doacoes.js` e `app.js` não mudaram e anexar o link da execução verde do CI.

---



### Tensões entre os requisitos

| Conflito | Como foi resolvido |
|---|---|
| RNF1 × RNF2: rede ruim pediria aceite offline; consistência exige confirmação do servidor | Prioriza RNF2: o aceite sempre passa pelo servidor; a interface mostra erro claro se a rede falhar |
| RNF1 × RNF3: polling gera mais requisições ao banco | Volume do piloto é baixo; intervalo de atualização ajustável |
| RNF2 × RNF3: lock pessimista seria mais "forte", mas não é portável | Verificação otimista atende a regra e funciona igual no SQLite e no PostgreSQL |



## Critérios de validação do projeto

O confronto entre o produto e os critérios de aceite, com a evidência de cada um, está em
[`docs/validacao.md`](validacao.md). Os testes automatizados são descritos no
[ADR 0008](adr/0008-estrategia-de-testes-e-pipeline.md).

## Uso de IA

Usamos IA para propor as alternativas das 3 decisões de projeto e montar a tabela de trade-offs da decisão #2. Verificamos que cada alternativa era tecnicamente viável para a stack do projeto (Node.js + SQLite/PostgreSQL) e que a justificativa de cada decisão correspondia a uma regra de negócio ou risco já registrado em `docs/analise.md`.
