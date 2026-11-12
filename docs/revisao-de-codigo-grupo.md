# Revisão de código - Prato Cheio (Grupo)

- **Repositório revisado:** https://github.com/RodrigoKlappoth/Prato-Cheio
- **Versão revisada:** commit `b98fc6b` (branch `main`, após o merge do PR #16)
- **Revisores:** grupo g1126 - Gabrieli Lembeck, Heloísa Cabral, Julio Bezerra, Mileine de Freitas e Thomas Steinback.
- **Data:** 12/11/2026
- **Escopo:** `src/`, `public/tela.js`, `prisma/` (schema e as 5 migrations), `scripts/`, `tests/`, `.github/workflows/ci.yml`, README e `docs/`
- **Como foi feita:** leitura do código (revisão estática). Não rodamos `npm test` na nossa máquina, então o resultado dos testes abaixo vem do CI e da documentação de vocês, não de uma execução nossa.

Legenda: ✅ atende · ⚠️ atende em parte · ❌ não atende

---

## 1. Checklist

| # | Item | Situação | Comentário |
|---|------|:--------:|------------|
| 1 | O projeto tem README com objetivo, integrantes e instruções para rodar | ✅ | README completo, com `.env.example` e comando `semear` para a demo. |
| 2 | Organização em camadas (rotas, regras, acesso ao banco) | ✅ | `app.js` (rotas) → `doacoes.js` / `usuarios.js` (regras) → `repositorio.js` (Prisma). Fácil de navegar. |
| 3 | Nomes claros e consistentes | ✅ | Nomes em português, descritivos (`exigirOngAprovada`, `contarAceitesEmAbertoDaOng`). |
| 4 | Comentários explicam o *porquê* | ✅ | Ponto forte do projeto: os comentários citam a RN e o ADR. Um deles está desatualizado (ver P-08). |
| 5 | Validação de entrada no servidor | ⚠️ | Campos obrigatórios, data e cidade são validados. Faltam limite de tamanho nos textos e uma validação de e-mail melhor (P-07). |
| 6 | Tratamento de erros | ⚠️ | Erros de regra saem com status certo. Erros inesperados (banco fora, bug) também saem como `400` com a mensagem interna (P-03). |
| 7 | Autenticação e senhas | ✅ | `scrypt` com sal, `timingSafeEqual`, cookie `httpOnly` + `sameSite=lax` + `secure` em produção, token de 32 bytes aleatórios. |
| 8 | Autorização por papel e por dono do recurso | ✅ | Papel, situação da ONG, cidade e dono da doação são conferidos no servidor, não só na tela. |
| 9 | Proteção contra XSS na tela | ✅ | `tela.js` usa `textContent` em todos os pontos que mostram dado do usuário. Não achamos `innerHTML` com dado externo. |
| 10 | Concorrência / consistência dos dados | ⚠️ | O aceite é atômico (`updateMany` condicional). A confirmação de retirada e o cancelamento não são (P-01). Há também um dado duplicado que fica desatualizado (P-02). |
| 11 | Modelo de dados e migrations versionadas | ✅ | Prisma com enums para papel, situação e status. Migrations no repositório e aplicadas também nos testes. |
| 12 | Testes automatizados cobrindo as regras | ⚠️ | 84 testes, banco PostgreSQL em memória (PGlite) criado pelas migrations reais. Não há teste de concorrência (P-01). |
| 13 | CI rodando testes a cada PR | ⚠️ | O CI roda os testes e verifica se a aplicação sobe. O `sleep 3` pode falhar de vez em quando, e não há lint (P-05). |
| 14 | Segredos fora do repositório | ✅ | `.env` no `.gitignore`, só `.env.example` com valores fictícios, e o CI não precisa da `DATABASE_URL`. |
| 15 | Documentação de decisões (ADR) | ✅ | 11 ADRs, com os substituídos revisados em vez de apagados. |
| 16 | Fluxo de trabalho (branch, PR, template, definição de pronto) | ✅ | Template de PR com checklist e uma definição de pronto clara no README. |
| 17 | Documentação de entrega completa | ⚠️ | `docs/refatoracoes.md` ainda tem a "Refatoração 2" só com o modelo preenchido (P-09). |
| 18 | Front-end mantém o estado em dia e trata falhas | ⚠️ | Trata `401` e falta de rede em todas as chamadas. O papel e a situação da conta ficam congelados desde o login (P-10), e alguns textos e datas não batem com as regras do servidor (P-11, P-12). |
| 19 | Scripts de manutenção são seguros | ✅ | `semear` só apaga o banco com `--confirmar` e cria os dados pelas mesmas funções da tela. |
| 20 | Índices e restrições no banco | ⚠️ | Enums, `NOT NULL` e chaves estrangeiras certos. Faltam índices nas colunas usadas nos filtros, e `validade` não tem restrição no banco (P-15). |

---

## 2. Pontos fortes

1. **Aceite à prova de corrida.** `repositorio.aceitar` usa um único `updateMany` com `status: 'disponivel'` e `validade >= hoje` no `where`. Isso resolve de verdade o caso de duas ONGs aceitando a mesma doação ao mesmo tempo, e o código ainda relê a doação para dar a mensagem certa.
2. **Tempo como parâmetro (`agora`).** Todas as regras de prazo recebem a data por parâmetro. Assim os testes não dependem do dia em que rodam, e o fuso (`America/Sao_Paulo`) fica explícito.
3. **Validação de data cuidadosa.** `diaValido` recusa `2026-02-31`, que o `new Date` aceitaria em silêncio.
4. **Testes com banco real em memória.** Usar PGlite com as próprias migrations testa o SQL de verdade, sem depender do Neon nem de senha no CI.
5. **Rastreabilidade.** Código → RN → ADR → teste → `docs/analise.md`. Dá para entender o motivo de cada regra sem perguntar a ninguém.
6. **Cópia da cidade na doação (ADR 0011).** A decisão evita que uma doação antiga "mude de cidade" quando o doador corrige a conta. O raciocínio está bem documentado.

---

## 3. Problemas encontrados e propostas

Prioridade: **Alta** = pode gerar dado errado ou falha de segurança · **Média** = deveria ser corrigido nesta unidade · **Baixa** = melhoria.

### P-01 · Alta - Confirmar retirada e cancelar aceite não são atômicos

**Onde:** [`src/doacoes.js`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/src/doacoes.js#L124-L139), [`src/repositorio.js`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/src/repositorio.js#L80-L92)

`exigirDoacaoAceitaPor` lê a doação, confere o status e o dono, e depois `registrarRetirada` / `devolverParaDisponivel` fazem um `update` só pelo `id`. Entre a leitura e a escrita o estado pode mudar. Cenários concretos:

- A ONG clica em "confirmar retirada" e em "cancelar" quase juntos (dois cliques, duas abas, rede lenta). As duas leituras veem `aceita`. A retirada grava `retirada`, e o cancelamento grava `disponivel` por cima. A doação já entregue volta para a lista, com `retirada_em` preenchido e `ong_id` nulo, e a métrica do OBJ-01 fica errada.
- A ONG A cancela, a ONG B aceita, e um pedido atrasado de A (lido antes) roda o `update` e tira a doação da ONG B.
Eles já resolveram esse mesmo problema no aceite. A proposta é usar o mesmo padrão:

```js
// repositorio.js
export async function registrarRetirada(id, ongId, agora) {
  const { count } = await banco().doacao.updateMany({
    where: { id, ong_id: ongId, status: 'aceita' },
    data: { status: 'retirada', retirada_em: agora }
  });
  return count === 1 ? buscarPorId(id) : undefined;
}

export async function devolverParaDisponivel(id, ongId) {
  const { count } = await banco().doacao.updateMany({
    where: { id, ong_id: ongId, status: 'aceita' },
    data: { status: 'disponivel', ong: null, ong_id: null, aceita_em: null }
  });
  return count === 1 ? buscarPorId(id) : undefined;
}
```

Em `doacoes.js`, quando o retorno for `undefined`, relê a doação para escolher a mensagem, como já é feito em `aceitar`. Vale também um teste com `Promise.all([retirar, cancelar])` que confere que a doação termina em um estado só.

### P-02 · Média - O nome da ONG fica duplicado na doação e desatualiza

**Onde:** `schema.prisma` (campo `Doacao.ong`), `repositorio.aceitar`, `usuarios.editarConta`

No aceite, o nome da ONG é copiado para `doacoes.ong`. Desde o ADR 0011 a ONG pode mudar o próprio nome (`PATCH /api/eu`), mas as doações já aceitas continuam com o nome antigo. Diferente da cidade, aqui a cópia não protege nenhuma regra, porque o `ong_id` já existe.

O problema aparece na tela: em [`public/tela.js:541`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L541), o histórico do doador mostra "Aceita por / Retirada por" com `doacao.ong`, ou seja, o nome antigo. Já existe o teste CA-09.2, que garante isso para o nome do doador. Falta o equivalente para o nome da ONG.

**Proposta:** remover a coluna `ong` (migration) e buscar o nome pela relação `aceita_por`, como já fazem com `publicada_por` em `comNomeDoDoador`. Se quiserem manter a cópia como "nome no momento do aceite", registrem isso num ADR e mostrem o rótulo assim na tela.

### P-03 · Média - Erro inesperado sai como 400 e mostra a mensagem interna

**Onde:** [`src/app.js`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/src/app.js#L27-L36)

`responder` usa `erro.status ?? 400`. Uma queda do banco ou um erro do Prisma vira `400 Bad Request`, com o texto técnico do erro (que pode ter nome de tabela ou de coluna) chegando à tela. Além disso, o middleware de sessão chama `next(erro)`, e aí o Express responde com o HTML padrão dele, que inclui o stack trace fora de produção.

**Proposta:**

```js
} catch (erro) {
  if (erro.status) return res.status(erro.status).json({ erro: erro.message });
  console.error(erro);
  res.status(500).json({ erro: 'erro inesperado, tente de novo em instantes' });
}
```

Também propomos um `app.use((erro, req, res, next) => …)` no final do `criarApp` com a mesma lógica, para cobrir o middleware de sessão.

### P-04 · Média — Login sem limite de tentativas

**Onde:** `POST /api/login`

Não há limite de tentativas por e-mail ou IP, então dá para testar senhas sem parar. A senha mínima é de 8 caracteres e não há outra exigência. Também há uma diferença pequena de tempo de resposta: e-mail inexistente responde sem rodar o `scrypt`, o que permite descobrir quais e-mails têm conta.

**Proposta:** usar `express-rate-limit` (ou um contador simples por e-mail na tabela) em `/api/login` e `/api/cadastro`. Para o tempo de resposta, rodar `scrypt` contra um hash fixo quando o usuário não existir.

### P-05 · Baixa — O CI pode falhar sem motivo e não tem lint

**Onde:** `.github/workflows/ci.yml`

`npm start & sleep 3 && curl` depende da aplicação subir em menos de 3 segundos. Num runner lento, o check falha sem erro real.

**Proposta:**

```yaml
- name: Verificar se a aplicação sobe
  run: |
    npm start &
    for i in $(seq 1 20); do curl --fail -s http://localhost:3000/api/saude && exit 0; sleep 1; done
    exit 1
```

Sugerimos também adicionar ESLint e/ou Prettier como passo do CI, já que a definição de pronto pede "sem código morto nem `console.log` de depuração" e hoje isso só é conferido a olho.

### P-06 · Baixa - Sessões vencidas nunca são apagadas

**Onde:** `repositorio.buscarUsuarioPelaSessao`, tabela `sessoes`

Sessões vencidas são ignoradas na consulta, mas continuam no banco para sempre. Com sessões de 30 dias, a tabela só cresce. Também não existe "sair de todos os dispositivos", e trocar a cidade da conta não renova a sessão.

**Proposta:** apagar as sessões vencidas do usuário no login (`deleteMany({ where: { usuario_id, expira_em: { lte: agora } } })`) ou com um script agendado. Considerar um índice em `sessoes(usuario_id)`.

### P-07 · Baixa - Validações fracas em textos livres

**Onde:** `usuarios.cadastrar`, `doacoes.criarDoacao`

- O e-mail só é conferido com `includes('@')`, então `a@` passa.
- `nome`, `tipo` e `quantidade` não têm tamanho máximo. Alguém pode publicar uma doação com 100 KB de texto (o limite padrão do `express.json`), e isso quebra o layout da lista de todas as ONGs da cidade.
- `quantidade` é texto livre, o que impede somar "porções salvas" para métricas no futuro.

**Proposta:** uma regex simples de e-mail (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), limites como `nome ≤ 100` e `tipo/quantidade ≤ 200` (com teste de recusa `400`) e um ADR sobre manter `quantidade` livre ou separar número e unidade.

### P-08 · Baixa - Pequenas inconsistências

- [`src/regras.js:1`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/src/regras.js#L1) diz "A rede é de São Paulo", mas desde o ADR 0009 a rede é de Santa Catarina. O fuso `America/Sao_Paulo` continua certo para SC, então só o comentário precisa mudar.
- `app.js` usa caminho absoluto para o `index.html` e caminho relativo (`express.static('public')`) para o resto. Se a aplicação for iniciada de outra pasta, a página abre sem CSS e sem JS. Proposta: `express.static(fileURLToPath(new URL('../public', import.meta.url)))`.
- `avaliarOng` não confere a situação atual: dá para "aprovar" uma ONG já aprovada ou recusar uma já aprovada. Se reavaliar é permitido de propósito, vale um teste e uma linha no ADR 0010. Se não é, a regra deveria exigir `situacao === 'pendente'`.
- Se `senha_hash` estiver mal formado, `timingSafeEqual` lança erro de tamanho, que vira `400` com mensagem técnica (cai no P-03).

### P-09 · Baixa - Documentação da Unidade 3 incompleta

`docs/refatoracoes.md` tem a "Refatoração 2" e a seção "Limitações" ainda só com o modelo. Se a entrega já vai sair, preencham. Os itens P-01 e P-02 deste relatório são bons candidatos a "cheiro de código atacado", com teste antes e depois.

### P-10 · Média - A tela não percebe quando a coordenação aprova a ONG

**Onde:** [`public/tela.js:200-221`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L200-L221), [`:414`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L414), [`:608-615`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L608-L615)

`usuarioAtual` é preenchido uma vez, no login ou no `iniciar()`, e nunca é relido. O botão "Aceitar doação" depende de `usuarioAtual.situacao === 'aprovada'`. Por isso:

- uma ONG pendente com a página aberta é aprovada pela coordenação, volta para a aba (o `visibilitychange` recarrega as doações) e continua sem o botão e com o aviso "aguarda a aprovação". Ela só consegue aceitar depois de recarregar a página inteira, o que não é óbvio;
- no caminho contrário, a ONG que perde a aprovação continua vendo o botão e só recebe o `403` ao clicar.

**Proposta:** criar uma função `atualizarConta()` que chama `GET /api/eu`, atualiza `usuarioAtual` e o aviso de situação. Ela deve ser chamada no `visibilitychange` e no botão "Atualizar", antes de `carregarDoacoes()`.

### P-11 · Baixa - Textos da tela que contradizem as regras

- [`public/tela.js:467`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L467): a coordenação vê "Quando uma ONG **da sua cidade** criar conta, o pedido aparece aqui". Desde o ADR 0010 ela vê os pedidos de **todas** as cidades, e o próprio cartão mostra `cidade/estado`.
- [`tests/historico.test.js:65`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/tests/historico.test.js#L65): o teste se chama "a coordenação não tem histórico de doações, **porque a doação não tem cidade**". Desde o ADR 0011 a doação tem cidade, então o motivo escrito no nome do teste não vale mais. Como o nome do teste é citado em `docs/analise.md`, o texto errado se espalha pela documentação.

**Proposta:** atualizar os dois textos e procurar outras frases com "da sua cidade" no `index.html` e no `tela.js`.

### P-12 · Baixa - A tela calcula "hoje" pelo relógio do navegador, e o servidor pelo fuso da rede

**Onde:** [`public/tela.js:92-105`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L92-L105), `:340`, `:367-371`

`dataLocal()` usa o fuso do aparelho. O servidor usa `America/Sao_Paulo` (ADR 0007). Num celular com fuso diferente, ou com data errada, o atalho "hoje" e o `min` do calendário oferecem uma data que o servidor recusa ("prazo já vencido"), e `prazoLegivel` pode chamar de "amanhã" o que para a regra é "hoje". O servidor continua correto, mas a tela promete algo que a regra não cumpre.

**Proposta:** calcular com `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`, o mesmo cálculo de `hojeNaRede`, ou receber o "hoje da rede" junto com `/api/localidades`.

### P-13 · Baixa - Pequenos problemas de fluxo no front-end

- **`enviar` não tem `catch`** ([`tela.js:74-90`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/public/tela.js#L74-L90)). Se `acao()` lançar um erro (por exemplo, `entrouComo` com um campo inesperado), o botão volta ao normal, mas a pessoa não vê mensagem nenhuma e o erro fica só no console. Proposta: `catch (e) { mostrarErro(formulario, 'algo deu errado. Recarregue a página'); console.error(e); }`.
- **Sair ignora a falha do logout** (`:277-280`). Se o `POST /api/logout` falhar, a tela mostra o login, mas o cookie continua válido e um F5 entra de novo na conta. Num computador compartilhado (ONG, padaria), isso importa. Proposta: avisar quando `ok` for falso.
- **O doador não recebe atualização automática** (`:608-615`). O `visibilitychange` recarrega as telas da ONG e da coordenação, mas não o histórico do doador. Ele só descobre que a doação foi aceita clicando em "Atualizar". Proposta: incluir `tela-doador` → `carregarRecentes()`.

### P-14 · Baixa — Corrida na mudança de cidade (RN-07)

**Onde:** [`src/usuarios.js:155-159`](https://github.com/RodrigoKlappoth/Prato-Cheio/blob/b98fc6b/src/usuarios.js#L155-L159)

`editarConta` primeiro conta as doações em circulação e só depois atualiza a conta. Se o doador publicar uma doação em outra aba entre esses dois passos, a conta muda de cidade com uma doação aberta na cidade antiga, exatamente o que a RN-07 proíbe. É o mesmo padrão "lê, decide, escreve" do P-01, só que bem menos provável.

**Proposta:** colocar a contagem e o `update` numa `banco().$transaction(..., { isolationLevel: 'Serializable' })`, ou registrar a corrida como dívida conhecida no ADR 0011, se decidirem não tratar.

### P-15 · Baixa - Faltam índices e restrições no banco

**Onde:** `prisma/schema.prisma` e `prisma/migrations/`

O PostgreSQL **não cria índice sozinho para chave estrangeira**, e nenhuma migration cria. As consultas mais frequentes filtram por colunas sem índice:

| Consulta | Colunas filtradas |
|----------|-------------------|
| `listarDisponiveis` (toda abertura da tela da ONG) | `doacoes.estado, cidade, status, validade` |
| `listarPublicadasPor` / `contarEmCirculacaoDoDoador` | `doacoes.doador_id` |
| `listarAceitasPor` / `contarAceitesEmAbertoDaOng` | `doacoes.ong_id` |
| `listarOngsPorSituacao` | `usuarios.papel, situacao` |

Além disso, `validade` é `TEXT` sem restrição. A regra "AAAA-MM-DD" só existe no JavaScript, e a comparação de texto com `gte` (ADR 0007) só funciona se esse formato for respeitado. `listarPublicadasPor` e `listarAceitasPor` também não têm paginação e devolvem o histórico inteiro.

**Proposta:**

```prisma
model Doacao {
  // ...
  @@index([estado, cidade, status, validade])
  @@index([doador_id])
  @@index([ong_id])
}
```

Com uma migration manual que acrescente `ALTER TABLE doacoes ADD CONSTRAINT validade_formato CHECK (validade ~ '^\d{4}-\d{2}-\d{2}$');` e um `take: 50` nos históricos.

### P-16 · Baixa - Lacunas nos testes

Os 84 testes cobrem bem as regras de negócio, cada uma com o caso de recusa. Faltam:

1. **Concorrência:** nenhum teste usa `Promise.all`. O P-01 e o P-14 passariam despercebidos. Até o aceite atômico, que é a regra RN-02, não tem um teste que dispare dois aceites ao mesmo tempo.
2. **Nome da ONG no histórico do doador** depois de a ONG corrigir o nome (P-02).
3. **Erro inesperado:** nenhum teste confere o que acontece quando o banco lança um erro (P-03). Dá para simular com `vi.spyOn(repo, 'listarDisponiveis').mockRejectedValue(new Error('x'))` e esperar `500`.
4. **Front-end:** `public/tela.js` tem 626 linhas e nenhum teste. Sugerimos começar por funções puras (`prazoLegivel`, `comoFrase`, `estadoDaDoacao`), separando-as num módulo, ou por um teste de ponta a ponta com Playwright do fluxo "publicar → aceitar → retirar", que é o item 1 da definição de pronto de vocês.

---

## 4. Revisão do código, arquivo por arquivo

| Arquivo | O que está bom | O que mudar | Itens |
|---------|----------------|-------------|-------|
| `src/app.js` | Rotas curtas, toda a regra fica fora da rota, `PATCH` usado corretamente em `/api/eu`. | Erro inesperado como `400`. `static` com caminho relativo. Rota `/api/...` inexistente devolve HTML 404 do Express em vez de JSON (sugestão: `app.use('/api', (req, res) => res.status(404).json({ erro: 'rota não encontrada' }))` depois das rotas). | P-03, P-08 |
| `src/server.js` | Avisa quando falta `DATABASE_URL` em vez de quebrar. | — | — |
| `src/db.js` | Cliente criado sob demanda, e `usarBanco` permite injetar o banco de teste. | — | — |
| `src/regras.js` | `diaValido` e `hojeNaRede` são pequenos, testáveis e bem explicados. | Comentário "rede de São Paulo". `exigirCampos` usa `!dados[campo]`, que trata `0` como vazio (hoje não afeta, porque tudo é texto). | P-08 |
| `src/usuarios.js` | Hash de senha correto. `semSenha` impede vazar o hash. `cadastrarPeloSite` não deixa ninguém se cadastrar como coordenação. | Login sem limite de tentativas. Corrida na mudança de cidade. `avaliarOng` sem conferir a situação atual. | P-04, P-08, P-14 |
| `src/doacoes.js` | `aceitar` é o melhor trecho do projeto. A ordem das verificações em `exigirDoacaoAceitaPor` está explicada. | Retirada e cancelamento sem escrita condicional. Sem limite de tamanho em `tipo`/`quantidade`. | P-01, P-07 |
| `src/repositorio.js` | Toda a parte do Prisma num só lugar. `select` explícito em `listarOngsPorSituacao`, sem expor o hash. | `update` por `id` sem condição. Históricos sem paginação. Sessões vencidas acumulam. | P-01, P-06, P-15 |
| `src/localidades.js` | Lista curada, que cresce por PR. `Object.hasOwn` evita aceitar `__proto__` como estado. | — | — |
| `public/tela.js` | Só `textContent` (sem XSS), trata `401` e falta de rede, respeita `prefers-reduced-motion`, usa `aria-pressed` e `aria-live`, não mostra botão que a regra recusa. | Estado da conta congelado. Textos desatualizados. Data pelo fuso do navegador. `enviar` sem `catch`. Logout que falha calado. | P-10 a P-13 |
| `prisma/schema.prisma` | Enums para os estados. Relações com nome. `onDelete` pensado (`Cascade` na sessão, `SetNull` na ONG). | Coluna `ong` duplicada. Sem índices. | P-02, P-15 |
| `prisma/migrations/` | Cada migration explica o preenchimento dos dados antigos antes do `SET NOT NULL`. A de 27/10 avisa quem aplica sobre cidades fora da lista. | Sem índices nem `CHECK`. | P-15 |
| `scripts/` | `criar-conta.js` evita duplicação entre os dois comandos. `semear` exige `--confirmar` e passa pelas regras. | A senha vai na linha de comando e fica no histórico do terminal. Para a coordenação, vale ler de `process.env` ou perguntar no terminal. | — |
| `tests/` | Banco real em memória, `agora` fixado, os nomes dos testes são os critérios de aceite. `deploy.test.js` simula a Vercel com `chdir` para pasta vazia, o que é criativo. | Sem concorrência, sem erro `500`, sem front-end. Um nome de teste desatualizado. | P-11, P-16 |
| `.github/workflows/ci.yml` | Não precisa de segredo e prova que a aplicação sobe. | `sleep 3` frágil. Sem lint. | P-05 |

---

## 5. Resumo para o grupo

O projeto está **bem estruturado, bem testado e muito bem documentado**. A rastreabilidade de regra → ADR → teste é a melhor coisa do repositório, e o aceite atômico mostra que vocês entenderam o problema de concorrência.

A correção mais importante é **estender ao cancelamento e à retirada o padrão de escrita condicional que vocês já usam no aceite (P-01)**. Hoje esses dois fluxos podem deixar uma doação já retirada de volta na lista. Depois disso, em ordem: tirar ou justificar o nome duplicado da ONG (P-02), tratar erro inesperado como `500` (P-03), limitar as tentativas de login (P-04) e fazer a tela reler a conta, para a ONG aprovada não precisar recarregar a página (P-10). Para fechar, um teste de concorrência com `Promise.all` protegeria o P-01 e a RN-02 de voltarem a quebrar (P-16).

| Prioridade | Itens |
|-----------|-------|
| Alta | P-01 |
| Média | P-02, P-03, P-04, P-10 |
| Baixa | P-05, P-06, P-07, P-08, P-09, P-11, P-12, P-13, P-14, P-15, P-16 |
