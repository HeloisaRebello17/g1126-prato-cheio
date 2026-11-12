# Análise para refatoração — Prato Cheio

*O que encontramos no código, o que propusemos e por quê. As refatorações aplicadas estão em [refatoracoes.md](refatoracoes.md).*

## Como olhamos o código

- Lemos os 6 arquivos de `src/` procurando os cheiros do catálogo do [refactoring.guru](https://refactoring.guru/refactoring/smells)
  e as técnicas do catálogo do [refactoring.com](https://refactoring.com/catalog/).
- Rodamos `npm run test:cobertura` para saber **onde os testes protegem e onde não protegem** antes de mexer.
  Linha de base: 9 arquivos, **163 testes passando**, 98,11% de linhas cobertas.
- Usamos `grep` para conferir quem chama cada função e onde cada texto se repete.

Critério para escolher: cheiro **real e visível** (dá para apontar a linha), mudança **pequena**, que **não muda
comportamento** e que dá para **proteger com teste**. Nada de mudar arquitetura ou banco.

## O que encontramos

| # | Onde | Cheiro (refactoring.guru) | O que vimos | Proposta | Feito? |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/doacoes.js` — `listarAceitas`, `aceitar`, `cancelar` | Duplicated Code | mesma validação do nome da ONG copiada 3 vezes, mais `ong.trim()` repetido | *Extract Function* → `exigirOng` | ✅ Ref. 2 |
| 2 | `src/doacoes.js` — `aceitar` | Primitive Obsession (literais mágicos) | `'disponivel'`, `'vencida'`, `'cancelada'` escritos à mão nas comparações | *Replace Magic Literal* → `STATUS` | ✅ Ref. 3 |
| 3 | `src/repositorio.js` — `buscarAceitaPorOng` | Dead Code | ninguém chama; só um teste feito para ela; o grupo já tinha anotado em `diagramas.md` (item 8) | *Remove Dead Code* | ✅ Ref. 4 |
| 4 | `src/app.js` — 10 rotas | Duplicated Code | o mesmo `try/catch` em todas, mudando só o status; `autenticar + exigirPerfil` repetido em 8 rotas | *Extract Function* + *Parameterize Function* → `responder()` | ✅ Ref. 5 |
| 5 | `src/doacoes.js` — `cancelarPeloDoador` e `historico` | Duplicated Code (parcial) | ambos fazem "id válido → busca → é do doador?" | *Extract Function* (`buscarDoacaoDoDoador`) | ❌ ordem diferente nas duas; extrair exigiria um parâmetro de "modo" |
| 6 | `src/doacoes.js` — `validarValidade` | Duplicated Code (pequeno) | `validade.split('/').map(Number)` também está dentro de `paraData` | *Extract Function* | ❌ duas linhas; ganho baixo |
| 7 | `src/doacoes.js` — `criarDoacao` | Long Method (leve) | condição longa para validar quantidade | *Extract Function* → `validarQuantidade` | ❌ já coberta e legível; ficou como próxima |
| 8 | `src/repositorio.js` — SQL | Primitive Obsession | status escritos dentro do SQL | migração com `CHECK (status IN (...))` | ❌ mexe no banco; fora do escopo |
| 9 | `src/autenticacao.js` | — | `emailValido` exige `.com` (recusa `.org`, `.br`) | — | ❌ é **regra de negócio**, não refatoração; levar ao grupo |

## Por que propusemos essas quatro

- **Ref. 2 (`exigirOng`)** — é o exemplo clássico de duplicação: três cópias da mesma regra. Se a regra muda e
  alguém esquece uma cópia, uma rota passa a aceitar o que as outras recusam. A extração deixa a regra num lugar só.
- **Ref. 3 (`STATUS`)** — o status é o coração das regras (H5a, H5c). Um texto digitado errado numa comparação
  não dá erro: a regra simplesmente para de funcionar. Com a constante o nome fica centralizado e conferido por teste.
- **Ref. 4 (código morto)** — já era uma pendência registrada pelo próprio grupo. A função passava a impressão de
  uma regra que não existe no caso de uso. Remover é a refatoração mais barata e segura que existe.
- **Ref. 5 (`responder`)** — era o maior bloco repetido do projeto (10 cópias). Além disso a cobertura mostrou
  que 3 desses `catch` **nunca tinham sido testados**, então essa refatoração também serviu de motivo para
  criar testes de caracterização das rotas, que agora protegem o mapeamento de status HTTP de todas elas.

## Testes que precisaram ser criados antes de refatorar

| Refatoração | Faltava | Teste criado |
| --- | --- | --- |
| Ref. 2 | nada garantia que o nome da ONG era gravado sem espaços | `doacoes-regras.test.js` — *"aceitar, listarAceitas e cancelar removem espaços nas pontas do nome da ONG"* |
| Ref. 3 | nada amarrava os nomes das constantes aos textos do banco | `doacoes-regras.test.js` — *"STATUS usa os mesmos textos gravados no banco"* |
| Ref. 4 | — (a remoção só tira o teste da função morta) | — |
| Ref. 5 | `catch` de `GET /api/doacoes`, `/api/minhas-coletas` e `/api/minhas-doacoes` sem teste | `tests/rotas.test.js` — 18 testes: sucesso, erro e repasse de parâmetros das 8 rotas de doação |

Todos os testes novos foram rodados **primeiro contra o código original** e passaram; só depois o código foi alterado.

## Resultado final

- 10 arquivos de teste, **182 testes passando**.
- Cobertura: linhas 99,5% (era 98,11%); `app.js` 100% (era 93,47%).
- `npm run quality` (eslint + prettier) e `npm run check` sem erros; o servidor sobe e `/api/saude` responde.
