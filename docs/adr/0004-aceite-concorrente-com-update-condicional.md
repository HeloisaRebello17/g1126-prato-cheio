# ADR 0004 — Aceite de doação com UPDATE condicional (verificação otimista)

- **Data:** 2026-10-28
- **Status:** aceito (formaliza a decisão #2 de `docs/projeto.md`)

## Contexto
Duas ONGs podem tentar aceitar a mesma doação quase ao mesmo tempo. A regra de negócio é que uma
doação aceita some para as demais (critério de aceite H1), e o aceite só é confiável se o sistema
nunca atribuir a mesma doação a duas ONGs (RNF2).

## Alternativas consideradas
1. **Verificação otimista:** `UPDATE doacoes SET status = 'aceita', ong = ? WHERE id = ? AND status = 'disponivel' RETURNING *`
   e checar se alguma linha voltou. Prós: instrução única e atômica, sem transação explícita, fácil de testar.
   Contras: quem perde só descobre depois (recebe erro e precisa escolher outra doação).
2. **Lock pessimista:** `SELECT ... FOR UPDATE` dentro de uma transação. Prós: bloqueia a linha até o fim.
   Contras: transação explícita, tratamento de timeout/deadlock, menor desempenho sob disputa.

## Decisão
**Alternativa 1.** A checagem do status e a gravação acontecem na mesma instrução, então não existe
janela entre "ler" e "gravar". A regra (vencida, já aceita) fica em `src/doacoes.js`; a garantia
atômica fica no SQL de `src/repositorio.js`.

## Consequências
- Positivas: consistência garantida pelo banco; código simples; o teste de concorrência
  (`tests/concorrencia.test.js`) dispara 10 requisições simultâneas contra o PostgreSQL real e exige
  exatamente 1 sucesso e 9 recusas.
- Negativas / o que abrimos mão: a ONG que perde precisa recarregar a lista.
- Riscos e o que fazer se der errado: se a disputa por uma mesma doação crescer muito, reavaliar o lock
  pessimista. Nunca remover o `AND status = 'disponivel'` do SQL: uma injeção desse defeito é detectada
  por 2 testes (`tests/concorrencia.test.js` e `tests/db.test.js`).

## Rastreabilidade
RNF2 (consistência no aceite); regra "doação aceita por uma ONG some para as outras"; critério H1;
decisão #2 de `docs/projeto.md`.
