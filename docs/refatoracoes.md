# Refatorações — Prato Cheio

*Trabalho 3 · uma seção por refatoração · o que importa é o motivo e a evidência*

## Refatoração 1 — Migração de SQLite para PostgreSQL

- **Motivo:** a U3 exige PostgreSQL acessível por `DATABASE_URL` com CI verde; orçamento zero levou
  a rodar em contêiner Docker ([ADR 0001](adr/0001-migracao-sqlite-para-postgresql.md), decisão #1 do `projeto.md`).
- **O que mudou:**
  - `src/db.js` — `node:sqlite` → `pg` (`Pool`); conversão `?` → `$n`; schema com `SERIAL` e
    `TIMESTAMPTZ DEFAULT now()`; `TRUNCATE ... RESTART IDENTITY` nos testes; leitura do `.env`.
  - `src/doacoes.js` — id que não é número responde "doação não encontrada" (no PostgreSQL viraria erro de tipo).
  - `docker-compose.yml` + `docker/postgres-init/` — PostgreSQL 16 local, com banco de testes separado.
  - `vitest.config.js` — testes no banco `pratocheio_test` (nunca no de desenvolvimento), um arquivo por vez.
  - `.github/workflows/ci.yml` — service container PostgreSQL.
  - `package.json` — dependência `pg`; saíram as flags que só existiam por causa do `node:sqlite`.
  - `README.md`, `.env.example` — como subir, conectar e testar o banco.
- **O que NÃO mudou:** regras de negócio, rotas da API, o SQL de `src/repositorio.js` e os 11 testes
  existentes (só foi atualizado um comentário). `validade` continua `TEXT dd/mm/aaaa` (ver ADR).
- **Evidência de que o comportamento se manteve:**
  - testes antes da mudança (commit `5af303d`, SQLite): **11 passando**
  - testes depois da mudança (PostgreSQL 16): **12 passando**, ou seja, os mesmos 11 mais um novo
    para id inválido
  - link da execução do CI verde: (preencher após abrir o PR da branch `migrarBD_Julio`)

## Como as refatorações 2 a 5 foram feitas

Cada uma seguiu o mesmo passo a passo (Fowler, *Refactoring*, cap. 2 — "antes de refatorar, tenha testes sólidos"):

1. rodar a suíte e confirmar que está verde;
2. ver se o trecho que vai mudar tem teste; **se não tiver, escrever o teste antes, contra o código original**;
3. refatorar em passo pequeno, sem mudar comportamento;
4. rodar a suíte inteira + `npm run quality` (eslint e prettier) + `npm run check`.

Comando usado: `npm run test:cobertura` (PostgreSQL 16 local, banco `pratocheio_test`).
O porquê de cada escolha (e o que ficou de fora) está em [analise-refatoracoes.md](analise-refatoracoes.md).

| Momento | Arquivos de teste | Testes | Observação |
| --- | ---: | ---: | --- |
| Antes de tudo | 9 | **163 passando** | linha de base; cobertura de linhas 98,11%, `app.js` 93,47% |
| Depois da Ref. 2 | 9 | 164 passando | +1 teste novo (trim do nome da ONG) |
| Depois da Ref. 3 | 9 | 165 passando | +1 teste novo (constantes = valores do banco) |
| Depois da Ref. 4 | 9 | 164 passando | −1 teste que só testava a função removida |
| Depois da Ref. 5 | 10 | **182 passando** | +18 testes de caracterização das rotas; `app.js` 100% |

## Refatoração 2 — Extrair função `exigirOng` (Extract Function)

- **Cheiro de código atacado:** *Duplicated Code* ([refactoring.guru](https://refactoring.guru/smells/duplicate-code)).
  A mesma linha `if (typeof ong !== 'string' || !ong.trim()) throw new Error('ONG é obrigatória')`
  aparecia em `listarAceitas`, `aceitar` e `cancelar`, e depois cada uma ainda chamava `ong.trim()` de novo.
- **Qual dor concreta isso resolvia:** se a regra do nome da ONG mudar (ex.: tamanho máximo), seria preciso
  lembrar de alterar 3 lugares; esquecer um deixaria uma rota aceitando o que as outras recusam.
- **Técnica:** *Extract Function* ([refactoring.com](https://refactoring.com/catalog/extractFunction.html) /
  *Extract Method* no [refactoring.guru](https://refactoring.guru/extract-method)).
- **O que mudou:**
  - `src/doacoes.js` — nova função `exigirOng(ong)` que valida e já devolve o nome sem espaços;
    as três funções passaram a usar `exigirOng` (e a variável `nomeOng`) em vez de repetir a validação e o `trim()`.
- **Evidência (testes verdes antes e depois):**
  - já existiam testes para ONG vazia/`undefined`/`null` nas três funções (`doacoes-regras.test.js`, "módulo de regras");
  - **faltava** teste do `trim()`, então antes de mexer foi criado
    *"aceitar, listarAceitas e cancelar removem espaços nas pontas do nome da ONG"* — passou no código original;
  - antes: 163 → com o teste novo: 164 passando → depois da refatoração: **164 passando**.

## Refatoração 3 — Constantes para os status da doação (Replace Magic Literal)

- **Cheiro de código atacado:** literais mágicos / *Primitive Obsession*
  ([refactoring.guru](https://refactoring.guru/smells/primitive-obsession) — "uso de constantes para codificar
  informação"). Os textos `'disponivel'`, `'vencida'` e `'cancelada'` estavam soltos nas comparações de `aceitar`.
- **Qual dor concreta isso resolvia:** um erro de digitação (`'disponível'` com acento, `'cancelado'`) não dá erro
  nenhum — a comparação só fica sempre falsa e a regra quebra em silêncio. Com a constante, um nome errado
  (`STATUS.CANCELADO`) vira `undefined` e é mais fácil de achar, e o editor autocompleta.
- **Técnica:** *Replace Magic Literal* ([refactoring.com](https://refactoring.com/catalog/replaceMagicLiteral.html) /
  *Replace Magic Number with Symbolic Constant* no [refactoring.guru](https://refactoring.guru/replace-magic-number-with-symbolic-constant)).
- **O que mudou:**
  - `src/doacoes.js` — `export const STATUS = Object.freeze({ DISPONIVEL, ACEITA, VENCIDA, CANCELADA })`;
    as comparações de `aceitar` usam `STATUS.*`.
  - O SQL de `repositorio.js` **não** foi mexido (ver "Limitações").
- **Evidência (testes verdes antes e depois):**
  - todos os ramos de status de `aceitar` já tinham teste: vencida (`doacoes.test.js`, `doacoes-regras.test.js`),
    cancelada (`cancelamento-doador.test.js`), já aceita (`coletas.test.js`, `concorrencia.test.js`);
  - foi criado o teste *"STATUS usa os mesmos textos gravados no banco"*, que confere que uma doação nova volta
    com `STATUS.DISPONIVEL` e uma aceita com `STATUS.ACEITA` — se alguém mudar o texto da constante, o teste quebra;
  - antes: 164 → depois: **165 passando**.

## Refatoração 4 — Remover `buscarAceitaPorOng` (Remove Dead Code)

- **Cheiro de código atacado:** *Dead Code* ([refactoring.guru](https://refactoring.guru/smells/dead-code)).
  `repositorio.buscarAceitaPorOng` não era chamada por `src/` nem por `public/` — só por um teste feito para ela.
  O próprio grupo já tinha anotado isso em [diagramas.md](diagramas.md), item 8 ("decidir com o grupo: virar história ou remover").
- **Qual dor concreta isso resolvia:** a função sugere uma regra que não existe no caso ("uma ONG só pode ter uma
  coleta aceita", por causa do `LIMIT 1`) e confunde quem lê; também é mais código para manter quando o schema mudar.
- **Técnica:** *Remove Dead Code* ([refactoring.com](https://refactoring.com/catalog/removeDeadCode.html)).
  Se um dia precisar, ela está no histórico do git.
- **O que mudou:**
  - `src/repositorio.js` — função removida;
  - `tests/db.test.js` — removido o teste *"buscarAceitaPorOng devolve a coleta aceita da ONG"*, que só testava a função morta;
  - `docs/diagramas.md` — item 8 marcado como resolvido.
- **Evidência (testes verdes antes e depois):**
  - `grep -rn buscarAceitaPorOng src public` → nenhuma chamada;
  - a consulta que o sistema usa de verdade para as coletas da ONG (`listarAceitasPorOng` / `GET /api/minhas-coletas`)
    continua coberta por 7 testes;
  - antes: 165 → depois: **164 passando** (a diferença é exatamente o teste removido); cobertura de `repositorio.js` continua 100%.

## Refatoração 5 — Extrair `responder()` nas rotas do `app.js` (Extract Function + Parameterize Function)

- **Cheiro de código atacado:** *Duplicated Code* ([refactoring.guru](https://refactoring.guru/smells/duplicate-code)).
  As 10 rotas repetiam o mesmo bloco `try { res.json(await ...) } catch (erro) { res.status(400).json({ erro: erro.message }) }`,
  mudando só o status; e `autenticacao.autenticar, autenticacao.exigirPerfil('ong'|'doador')` se repetia em 8 rotas.
- **Qual dor concreta isso resolvia:** para mudar o formato da resposta de erro (ex.: colocar um código junto da
  mensagem) seria preciso editar 10 blocos iguais; e uma rota nova escrita sem o `catch` deixaria a requisição sem resposta (no Express 4, erro em função `async` não é tratado sozinho).
- **Técnica:** *Extract Function* ([refactoring.com](https://refactoring.com/catalog/extractFunction.html)) +
  *Parameterize Function* ([refactoring.com](https://refactoring.com/catalog/parameterizeFunction.html)) — os blocos
  só diferiam no status de sucesso e de erro, que viraram parâmetros (`{ sucesso = 200, erro = 400 }`);
  e *Extract Variable* para `apenasOng` / `apenasDoador`.
- **O que mudou:**
  - `src/app.js` — função `responder(acao, { sucesso, erro })`; `erro` pode ser número ou função
    (`naoEncontradaVira404`, usada no cancelamento pelo doador); arrays `apenasOng` e `apenasDoador`.
    Rotas, caminhos, perfis e status continuam os mesmos.
- **Evidência (testes verdes antes e depois):**
  - a cobertura mostrou que os `catch` de 3 rotas **não tinham teste** (`app.js` linhas 35, 43 e 76:
    `GET /api/doacoes`, `GET /api/minhas-coletas`, `GET /api/minhas-doacoes`);
  - por isso, **antes** de refatorar, foi criado `tests/rotas.test.js` (testes de caracterização): simula as regras
    com `vi.mock` e confere, para cada uma das 8 rotas de doação, o status de sucesso, o status de erro
    e a mensagem, mais o caso 404 do cancelamento e o que cada rota repassa (id da URL, usuário logado, corpo, filtro);
  - testes novos no código original: **182 passando**, `app.js` passou de 93,47% para 100% de linhas;
  - depois da refatoração: **182 passando**, `app.js` 100%; `npm run quality` e `npm run check` sem erro;
    `node src/server.js` sobe e `GET /api/saude` responde `{"ok":true}`.

---

**Limitações e o que ficou de fora:**

- **Status no SQL:** os textos `'disponivel'`, `'aceita'` etc. continuam escritos dentro das consultas de
  `repositorio.js`. Trocar por `${STATUS.X}` dentro do SQL misturaria interpolação com consulta (abre espaço para
  injeção se alguém copiar o padrão) e o ganho é pequeno. O ideal seria um `CHECK (status IN (...))` numa migração nova.
- **`cancelarPeloDoador` e `historico`** repetem "id válido → busca → é do doador?". Parece duplicação, mas a ordem
  é diferente nas duas (o cancelamento tenta o `UPDATE` antes de buscar), então extrair agora deixaria uma função
  com `if` de modo. Ficou anotado.
- **`criarDoacao`** tem validações longas de quantidade e tipo; daria para extrair `validarQuantidade`, mas já está
  coberta e legível, e preferimos parar em 4 refatorações pequenas.
- Os detalhes de tudo que foi encontrado estão em [analise-refatoracoes.md](analise-refatoracoes.md).
