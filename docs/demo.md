# Roteiro da demo — Prato Cheio

*Trabalho 3 · 3 minutos · outra pessoa precisa conseguir reproduzir só lendo isto*

## Antes de começar

```bash
npm install
npm run db:migrar
npm start
```

## Roteiro (3 minutos)

| Tempo | O que mostrar | O que se prova |
|---|---|---|
| 0:00–0:20 | O problema em uma frase | por que o produto existe |
| 0:20–1:50 | A história funcionando de verdade | o produto executa ponta a ponta |
| 1:50–2:30 | Um caso de erro tratado | o limite foi pensado |
| 2:30–3:00 | O que falta e por quê | vocês sabem onde estão |

## Passo a passo reproduzível

1. Suba o banco e a aplicação: `docker compose up -d`, `cp .env.example .env`, `npm install`, `npm start`. Abra `http://localhost:3001`.
2. Em **Cadastro**, crie um doador (`doador@demo.com`, senha `demo1234`) e uma ONG (`ong@demo.com`, senha `demo1234`). *Esperado:* depois de cadastrar, o usuário já entra autenticado na tela principal (use **Sair** para trocar de usuário).
3. Como **doador**, publique uma doação: tipo `Arroz`, quantidade `5`, validade uma data futura no formato `dd/mm/aaaa`. *Esperado:* a doação é registrada.
4. Clique em **Sair**, entre em **Entrar** como **ONG** (`ong@demo.com`). *Esperado:* a doação aparece na lista; filtre por `arr` e ela continua aparecendo.
5. Aceite a doação pelo botão do cartão da doação. *Esperado:* a doação sai da lista e aparece em "minhas coletas".
6. **Caso de erro:** como doador, tente publicar com validade `31/02/2099` (ou uma data passada). *Esperado:* mensagem de erro e nenhuma doação criada.
7. Opcional, concorrência: `npx vitest run tests/concorrencia.test.js`. *Esperado:* 4 testes passando (10 ONGs disputam a mesma doação e só uma vence).
8. O que falta: notificação externa, confirmação de coleta pelo voluntário e histórico de cancelamentos (ver `docs/validacao.md`).

## Testado por

Outro integrante executou este roteiro sem ajuda: **[nome]**, em **[data]**.
Se ele travou em algum passo, o roteiro está incompleto — corrija antes de entregar.
