# Retrospectiva — Integração (Trabalho 4)

- **Data:** 18/11/2026 · **Grupo:** Prato Cheio

## O que decidimos nesta iteração

- **Validar o fluxo inteiro, não só cada história.** Criamos cenários que cruzam várias histórias e
  usuários (`tests/integracao.test.js`) e um script que roda os mesmos cenários contra o sistema no ar
  (`scripts/cenarios-integracao.mjs`), em vez de confiar que "cada PR passou no CI".
- **Corrigir o defeito de merge com um teste que o impeça de voltar**, e provar que o teste detecta o
  defeito rodando-o contra o código antigo.
- **Ser honestos na validação:** H1, H4 e H5b estavam marcados como "sim" no Trabalho 3; dividimos os
  critérios e registramos o que é parcial ou não atende.

## Dificuldades

- **Conflitos de merge recorrentes** em `README.md`, `package.json` e `package-lock.json` — arquivos que
  todo mundo mexe. O mais caro foi em `src/app.js` (merge `277e3f9`): a refatoração e a H5c alteraram as
  mesmas rotas, e a resolução manteve os dois lados.
- **CI verde não pegou o problema.** As rotas duplicadas eram código morto (o Express usa a primeira), então
  todos os testes passavam. Só lendo o código integrado foi possível perceber.
- **"Funciona na minha máquina" ao contrário:** no Windows o Prettier acusava 27 arquivos (fim de linha
  CRLF) e o Vitest falhava ao carregar (`c:` minúsculo no terminal do VS Code), enquanto o CI passava.
- **Branches de longa duração** (`Thomas`, `migrarBD_Julio`) acumularam diferenças e geraram os
  conflitos maiores.

## O que funcionou

- O CI com **PostgreSQL real** desde o Trabalho 3: a migração de banco foi integrada sem surpresas de SQL.
- A regra "toda mudança entra por PR": o histórico (`git log --merges`) permitiu rastrear exatamente qual
  merge introduziu o defeito, com `git show --remerge-diff` e `git blame`.
- Separação em camadas (ADR 0007): a correção ficou contida em `app.js`, sem tocar regra nem banco.

## Aprendizados

- Conflito em código se resolve **escolhendo** depois de entender os dois lados, não somando. Em
  `package-lock.json`, regenerar com `npm install`.
- Um teste de integração precisa envolver **mais de uma história e mais de um usuário** sobre o mesmo
  dado; é aí que aparecem os erros de encaixe.
- CI verde é condição necessária, não suficiente: revisão do diff do merge também é parte da integração.
- Configuração do repositório (`.gitattributes`) faz parte da integração quando a equipe usa sistemas
  operacionais diferentes.

## O que mudaríamos

- Fazer `git pull`/rebase da `main` com mais frequência e manter branches curtas (uma história por branch).
- No PR de merge com conflito, o revisor olhar especificamente os arquivos que conflitaram.
- Escrever o teste de integração **junto** com cada história nova, não só no fim.

## Próximos passos

- Notificação ativa (e-mail/push) ao estabelecimento quando a ONG cancela (H4b); hoje ele só vê a observação ao abrir a tela. Retorno automático por não comparecimento (H5b).
- Gravar no histórico as transições que ainda faltam (aceite e vencimento).
- Filtro por tipo ignorando acentos; teste automatizado de interface para o polling.
