
# Documento de Análise — Prato Cheio

_Trabalho 1 · versão resumida_

## Problema central

Comida boa é descartada por estabelecimentos enquanto ONGs precisam dela, mas a coordenação via WhatsApp é bagunçada e sem histórico, boa parte da comida estraga antes da coleta. O problema é falta de **visibilidade e velocidade** na conexão doador-ONG, não falta de comida ou de interesse.

## Incertezas

-   Estabelecimentos publicarão a doação cedo o suficiente, ou só perto do vencimento?
-   ONGs checarão a ferramenta com frequência sem o "empurrão" do WhatsApp?
-   Um bairro só terá volume suficiente para validar o piloto em poucas semanas?

## Stakeholders
| Stakeholder | Interesse | Influência | O que espera |
| :--- | :--- | :---: | :--- |
| **Marta** | Organizar | Alta | Ferramenta |
| **Estabelecimento** | Descartar doações | Média | Publicar fácil, sem integração |
| **ONG** | Receber a tempo | Alta | Ver e coletar rápido |
| **Voluntário de coleta** | Usar sem atrito | Média | Funciona com internet ruim |

## Objetivos de impacto

1.  Reduzir desperdício de comida boa.
2.  Aumentar refeições entregues.
3.  Reduzir tempo entre "disponível" e "coletado".

## Regras de negócio

-   Doação exige: tipo, quantidade, validade/janela de retirada.
-   Perecível tem janela curta — perde-se se não coletado a tempo.
-   Doação aceita por uma ONG some para as outras.
-   ONG mais próxima leva vantagem logística.
-   Restrições: equipe pequena, orçamento zero, mobile web, sem integração com restaurantes, um bairro, poucas semanas.

## Histórias de usuário
| # | História | INVEST: O que falha |
| :-: | :--- | :--- |
| **1** | Como estabelecimento parceiro,<br>quero publicar a disponibilidade de uma doação (tipo de alimento, quantidade e janela de retirada)<br>para que ONGs próximas possam vê-la e coletá-la antes que estrague. | **S, T** — Embute solução no texto; falta critério de aceite com campos obrigatórios. |
| **2** | Como ONG,<br>quero publicar minha necessidade de doação<br>para que estabelecimentos parceiros interessados saibam o que estou buscando. | **I, E, S, T** — Duplica a #1; sem regra de negócio que sustente; não é pequena. |
| **3** | Como ONG,<br>quero filtrar as doações disponíveis por tipo de alimento<br>para que eu encontre rapidamente o que preciso sem navegar por doações irrelevantes. | Nenhum problema relevante. |
| **4** | Como ONG,<br>quero cancelar a coleta de uma doação que aceitei<br>para que ela volte a ficar disponível para outras ONGs, caso eu não consiga mais buscá-la. | **T** — Não define o que acontece com a doação após cancelar. |
| **5** | Como estabelecimento parceiro,<br>quero cancelar a entrega de uma doação já aceita (por exemplo, alimento vencido ou ONG que não apareceu para retirar)<br>para que o sistema reflita a realidade e a doação não fique presa indefinidamente. | **S, T** — "etc." esconde motivos distintos, na prática são várias histórias. |

**Ajustes:** história 5 dividida em 5a (vencimento automático), 5b (ONG não compareceu) e 5c (cancelamento manual com motivo). História 2 recomendada para fora do escopo do piloto, sem regra de negócio que a sustente; alternativa mais enxuta é a ONG cadastrar interesse por tipo e ser notificada.

## Critérios de aceite (exemplos)

-   **H1:** Dado que um estabelecimento publica uma doação, quando salva a publicação, então tipo, quantidade e janela de retirada devem estar preenchidos e, quando uma ONG a aceita, ela deixa de aparecer para as demais ONGs.
-   **H3:** Dado que existem doações disponíveis de tipos diferentes, quando a ONG aplica um filtro por tipo, então ela vê somente doações do tipo escolhido.
-   **H4:** Dado que uma ONG cancelou uma coleta aceita, quando confirma o cancelamento dentro do prazo de validade, então a doação volta a ficar disponível e o estabelecimento é notificado.
-   **H5a/b/c:** vencimento expira → status "vencida"; ONG não comparece → volta a ficar disponível; cancelamento manual → motivo registrado no histórico.

## Riscos
| Risco | Probabilidade | Impacto | Mitigação |
| :--- | :---: | :---: | :--- |
| **Baixa adesão no bairro piloto** | Média | Alto | Recrutar parceiros previamente |
| **Doação perdida por atraso na coleta** | Alta | Alto | Notificação imediata + contagem regressiva |
| **Conexão instável trava o uso** | Média | Médio | Interface leve, mobile-first |
| **Escopo crescer além do prazo** | Média | Alto | Manter apenas regras já validadas |

## Hipótese e experimento

**Hipótese:** publicação rápida + notificação imediata reduz o tempo médio entre disponibilidade e coleta, reduzindo o desperdício.

**Experimento:** piloto de 3 semanas em um bairro, com estabelecimentos e ONGs pré-recrutados. Para cada doação, registrar horário de publicação, primeiro aceite, coleta e validade; também registrar quantidade de doações publicadas, expiradas e refeições estimadas. Comparar os resultados com as 3 semanas anteriores de coordenação via WhatsApp.

**Métrica de sucesso:** reduzir em pelo menos 30% o tempo médio entre publicação e coleta e manter abaixo de 15% a proporção de doações expiradas. Como métrica complementar, comparar o número de refeições entregues nos dois períodos.

## Decisão de análise

-   **Problema:** o que entra no escopo do piloto dado o prazo curto.
-   **Alternativas:** (a) as 5 histórias como propostas; (b) só as sustentadas por regra de negócio (1, 3, 4, divisão de 5); (c) versão simplificada da história 2 (interesse + notificação, sem novo fluxo de match).
-   **Decisão:** alternativa (c), cobre as regras de negócio conhecidas sem duplicar lógica nem estourar prazo/equipe.
-   **Riscos:** se notificação por interesse não bastar para as ONGs, o fluxo completo de "pedido" pode precisar ser revisitado depois.

## Uso de IA

Usamos IA para avaliar as histórias pelo INVEST, propor a quebra da história 5 e redigir os critérios de aceite. Verificamos que tudo correspondia às regras de negócio informadas (nada inventado). Alteramos a abordagem da história 2: em vez de só dividi-la, decidimos removê-la do escopo e propor uma versão mais enxuta, com a justificativa registrada na Decisão de análise.
