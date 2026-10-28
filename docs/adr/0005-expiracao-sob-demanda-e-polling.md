# ADR 0005 — Expiração sob demanda e atualização da lista por polling

- **Data:** 2026-10-28
- **Status:** aceito (formaliza a decisão #3 de `docs/projeto.md` e a história H5a)

## Contexto
O risco "doação perdida por atraso na coleta" (probabilidade alta, impacto alto) exige que ONGs vejam
rapidamente novas doações e que doações vencidas deixem de aparecer. O orçamento é zero, a equipe é
pequena e o uso é em celular com internet instável (RNF1).

## Alternativas consideradas
1. **Polling no front-end + expiração sob demanda:** a interface recarrega a lista a cada 30 s; a
   doação vencida é marcada como `vencida` no momento de listar ou aceitar. Prós: nenhuma infraestrutura
   nova; funciona quando a rede cai e volta (cada requisição é independente). Contras: requisições
   repetidas sem novidade; doação vencida que ninguém consulta continua `disponivel` no banco.
2. **Notificação (e-mail/push) + job agendado:** Prós: aviso imediato; estado correto no banco.
   Contras: serviço externo, processo em segundo plano, conexão estável para receber o aviso.

## Decisão
**Alternativa 1.** A validade é comparada em JavaScript (`estaVencida` em `src/doacoes.js`), porque
`validade` é `TEXT dd/mm/aaaa` e não pode ser comparada no SQL (divergência 4 de `docs/diagramas.md`).
A doação vale até o fim do dia da validade.

## Consequências
- Positivas: zero infraestrutura extra; regra coberta por testes (vencida some da lista, não pode ser
  aceita, continua disponível no último dia).
- Negativas / o que abrimos mão: sem notificação externa; `vencida` só é gravada quando alguém consulta;
  `aceita → vencida` não existe.
- Riscos e o que fazer se der errado: com muitos usuários, aumentar o intervalo de polling ou migrar para
  a alternativa 2. Ao trocar `validade` para `DATE`, a marcação pode virar um `UPDATE` único.

## Rastreabilidade
Risco "doação perdida por atraso na coleta"; RNF1; história H5a; decisão #3 de `docs/projeto.md`.
