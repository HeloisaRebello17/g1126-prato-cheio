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
(contexto + dados ou componentes — em `docs/` ou como imagem)

## ADRs
Ver `docs/adr/`.

## Requisitos não-funcionais
| Requisito | Como afeta o design |
|---|---|

## Critérios de validação do projeto

## Uso de IA

Usamos IA para propor as alternativas das 3 decisões de projeto e montar a tabela de trade-offs da decisão #2. Verificamos que cada alternativa era tecnicamente viável para a stack do projeto (Node.js + SQLite/PostgreSQL) e que a justificativa de cada decisão correspondia a uma regra de negócio ou risco já registrado em `docs/analise.md`.
