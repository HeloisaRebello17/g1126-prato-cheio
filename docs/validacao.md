# Validação — Prato Cheio

*Trabalho 3 · confronto do produto com os critérios de aceite escritos na Unidade 1*

Copie aqui os critérios de aceite do seu `docs/analise.md` e marque um por um. **Um "não atende" bem justificado vale mais que um "sim" sem evidência.**

| # | Critério de aceite (da Unidade 1) | Atende? | Evidência |
|:--:|---|:--:|---|
| 1 | Publicar doação com tipo, quantidade positiva e validade válida; ONG aceita e a doação sai da lista | sim | Testes de publicação, validação, aceite e expiração em `tests/doacoes.test.js` |
| 2 | ONG filtra doações por tipo de alimento | sim | Teste de filtro por tipo em `tests/doacoes.test.js`; endpoint `GET /api/doacoes?tipo=...` |
| 3 | ONG cancela coleta aceita e a doação volta a ficar disponível | sim | Testes de cancelamento, posse da coleta e listagem em `tests/doacoes.test.js` |
| 4 | Cadastro e login de doador e ONG com controle de acesso | sim | Testes de cadastro, login e perfis; rotas protegidas em `src/app.js` |
| 5 | Doação vencida não aparece para ONG | sim | Testes de vencimento e marcação de status em `tests/doacoes.test.js` |
| 6 | Interface atualiza a lista periodicamente para ONG | sim | Polling de 30 segundos implementado em `public/index.html`; medição de carregamento registrada abaixo |

## Critérios que não atendem — por quê

- Medição do RNF1: com cache desabilitado e simulação de rede lenta (latência de 400 ms e 50 KB/s), a página de login carregou em 491 ms, transferiu 3.122 bytes e realizou 2 requisições. A página ficou dentro das metas de até 50 KB e 3 segundos; o aceite em rede móvel real ainda pode ser medido no celular.
- A migração para PostgreSQL do RNF3 continua pendente da Unidade 3; o produto atual usa SQLite.
- Notificações externas, histórico completo de cancelamentos e localização da ONG não fazem parte do fluxo implementado nesta iteração.

## Mudanças de critério ao longo do semestre

O cadastro e o login foram incorporados ao fluxo para identificar o perfil de cada usuário. A seleção manual de perfil foi removida da interface: o usuário autenticado acessa somente as operações permitidas ao seu perfil.

## Uso de IA

Nesta iteração, a IA auxiliou na implementação do filtro por tipo, cancelamento de coleta, polling, autenticação e testes. A equipe verificou o comportamento executando a suíte automatizada, que totaliza 28 testes aprovados.
