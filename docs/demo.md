# Roteiro da demonstração - Prato Cheio 

*Entrega N3 · produto integrado funcionando, um caso de erro e as limitações*

A demonstração é um **vídeo gravado da tela**. O roteiro abaixo diz,
cena por cena, **o que aparece na tela, o que fazer e o que deve acontecer**.

**Link do vídeo:** (https://drive.google.com/file/d/1B-sx-lTh-9yTy0DEpYVkdgzqlYKjZ3HW/view?usp=drive_link)

## 1. Preparação (antes de apertar o REC)

```bash
docker compose up -d        # PostgreSQL 16
cp .env.example .env
npm install
npm start                   # http://localhost:3001  → deve imprimir "banco pronto"
```

## 2. Cenas

| Tempo | Tela | Ação | O que deve aparecer | Legenda / narração sugerida |
|---|---|---|---|---|
| **0:00-0:41** | Tela inicial do Prato Cheio (as duas janelas) | Cadastrar doador(padaria) e ong| Padaria à esquerda, ONG à direita | "Prato Cheio: conecta estabelecimentos que têm comida sobrando a ONGs que precisam dela, antes que estrague." |
| **0:42-0:57** | Janela **padaria** | Publicar: tipo `Feijão`, quantidade `2`, validade = (`20/10/2027`). | Na doação aparece em **Minhas doações** como *disponível* | "1. O estabelecimento publica as doações (H1)." |
| **0:58-1:12** | Janela **ONG** | Apertar **F5** (a lista também se atualiza sozinha a cada 30 s, mas F5 evita esperar no vídeo). Clicar **Aceitar** no feijão. | Após aceitar, ele **sai da lista** e aparece em **Minhas coletas** | "2. A ONG filtra por tipo (H3) e aceita. A doação sai da lista para as outras ONGs." |
| **1:13-1:17** | Janela **ONG** → depois **padaria** | Clicar **Cancelar coleta**; na caixa que abre, digitar o motivo `teste` e confirmar. Ir para a janela da padaria e apertar F5. | Padaria: status *cancelada*. ONG: o arroz **sumiu** de Minhas coletas | "3. O estabelecimento cancela com motivo, que fica no histórico (H5c). A ONG vê na hora. E o mesmo ocorre com a ONG" |
| **1:18-1:29** | Janela **padaria** (caso de erro) | Publicar `frutas`, quantidade `1`, validade **`31/02/2029`**. Fechar o aviso. | Aviso **"A validade deve ser uma data válida."** (também em vermelho abaixo do campo); nenhuma doação nova em Minhas doações | "Caso de erro: 31 de fevereiro não existe. A publicação é recusada e nada é gravado." |
| **1:30-1:51** | **GitHub → Actions** | Mostrar os checks **CI, Lint e Prettier** verdes do último merge na `main`. | Três checks verdes | "Todo PR passa por CI com PostgreSQL real: 196 testes." |
| **1:52-2:09** | **Terminal** | Rodar `node scripts/cenarios-integracao.mjs` | Linha `validade 31/02 (data inexistente) … 400 … ✅` e a última linha **"todos os passos conferem ✅"** | "A tela barra o erro, mas o servidor também valida: mandando direto para a API, a resposta é 400. São 31 requisições conferidas contra o sistema no ar, com 2 ONGs e erros 400, 401 e 403." |
| **2:10-2:20** | [`docs/validacao.md`](validacao.md), seção **4. Limitações conhecidas** | Abrir o arquivo no GitHub e rolar devagar pela lista. | Lista de limitações visível | "Limitações: o estabelecimento vê a observação da ONG, mas não recebe notificação (H4), ONG que não aparece não libera a doação sozinha (H5b), janela de retirada é só uma data, sessões em memória. Resultado: 5 critérios atendidos, 2 parciais, 1 não." |

## 3. Ferramentas de gravação

- **Ferramenta:** OBS Studio e Canva (para legendas)
- **Resolução:** 1080p. Mouse visível e movimentos lentos.
- **Tempo:** 2:20 min.

## 4. Para a equipe saber explicar

Perguntas sobre o projeto que não foram explicadas no vídeo:

| Pergunta | Resposta curta | Onde está |
|---|---|---|
| Como vocês garantem que duas ONGs não aceitam a mesma doação? | `UPDATE … WHERE status = 'disponivel'`: o banco só deixa uma vencer. Teste com 10 ONGs simultâneas. | ADR 0004, `tests/concorrencia.test.js` |
| O que o CI verifica? | Testes no PostgreSQL real com cobertura mínima, migração rodando 2×, app subindo, lint e Prettier. | `.github/workflows/`, `docs/integracao.md` 1 |
| Que conflito de merge vocês tiveram? | `app.js` no merge `277e3f9`; somaram os dois lados → rotas duplicadas. | `docs/integracao.md` 4-5 |
| Qual a diferença entre `tests/integracao.test.js` e `scripts/cenarios-integracao.mjs`? | O teste roda no CI com banco descartável; o script bate no sistema no ar, como um usuário. | `docs/validacao.md` 2 |
