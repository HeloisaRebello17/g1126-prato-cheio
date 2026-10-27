# Prato Cheio — [nome do grupo]

Projeto da disciplina **Análise, Projeto e Desenvolvimento Ágil**.
Conecta doadores de alimentos excedentes a ONGs, antes que a comida se perca.

> Este repositório é a base do produto que evolui nas três unidades:
> walking skeleton (U1) → incremento guiado pelo projeto (U2) → produto refatorado (U3).

## Integrantes
- Gabrieli — @uabilbck
- Heloisa — @HeloisaRebello17
- Julio — @JulioMattoos  
- Mileine - @MileineFreitas
- Thomas - @thSteinback

## Atividade de diagramas (N2)
A entrega está em [`docs/diagramas-atividade.md`](docs/diagramas-atividade.md).
A versão original gerada pela IA está em [`docs/diagramas-ia-original.md`](docs/diagramas-ia-original.md).

## Como rodar

Requisitos: **Node.js 22.13 ou superior** e um **PostgreSQL** acessível pela variável `DATABASE_URL`.

> Esta é a **stack preferencial** da disciplina. Se o seu grupo optar por outra, registre o ADR de justificativa e garanta os mesmos compromissos: repositório público com CI verde, rota de saúde, testes por um comando, os três comandos documentados aqui no README e banco relacional em PostgreSQL.

**Banco local com Docker (recomendado):**

```bash
docker compose up -d          # sobe PostgreSQL na porta 5432
cp .env.example .env          # Windows: copy .env.example .env
npm install                   # só na primeira vez
npm run db:migrar             # cria o schema (o npm start também cria)
npm start                     # sobe em http://localhost:3001
npm test                      # roda os testes (no banco pratocheio_test)
npm run ci                    # verifica sintaxe e roda os testes (usado no CI)
npm run dev                   # sobe recarregando a cada alteração
```

Sem Docker, instale PostgreSQL na máquina ou use um serviço gratuito (Neon, Supabase, Render) e aponte `DATABASE_URL` no `.env`. Para os testes, crie um segundo banco e aponte `TEST_DATABASE_URL` para ele.

## O banco: PostgreSQL

O `src/db.js` concentra a conexão (`pg` + `DATABASE_URL`) e expõe `query()` devolvendo `{ rows }`. O SQL do repositório continua usando `?` como marcador; a conversão para `$1`, `$2`, … fica só no `db.js`. O schema (tabela `doacoes`) é criado por `migrar()` em `src/db.js`. A decisão está no [ADR 0001](docs/adr/0001-migracao-sqlite-para-postgresql.md).

### Credenciais e bancos (Docker local)

| Item | Valor |
|---|---|
| Host / porta | `localhost` / `5432` |
| Usuário / senha | `pratocheio` / `pratocheio` |
| Banco de desenvolvimento | `pratocheio` (usado por `npm start` e `npm run dev`, via `DATABASE_URL` no `.env`) |
| Banco de testes | `pratocheio_test` (usado por `npm test`; **é apagado a cada teste**) |
| URL de conexão | `postgres://pratocheio:pratocheio@127.0.0.1:5432/pratocheio` |

As credenciais servem só para desenvolvimento local. Nunca as use num banco exposto na internet. O arquivo `.env` não vai para o Git.

### Conectar no banco

Pelo terminal, sem instalar nada além do Docker:

```bash
docker compose exec postgres psql -U pratocheio -d pratocheio        # banco de dev
docker compose exec postgres psql -U pratocheio -d pratocheio_test   # banco de testes
```

Dentro do `psql`: `\dt` lista as tabelas, `SELECT * FROM doacoes;` mostra os dados, `\q` sai.

Por um cliente gráfico (DBeaver, pgAdmin, extensão do VS Code): crie uma conexão **PostgreSQL** com os dados da tabela acima.

### Comandos úteis do Docker

```bash
docker compose ps             # o contêiner está de pé? (STATUS deve ser "healthy")
docker compose logs postgres  # logs do banco
docker compose stop           # para o banco (os dados ficam guardados)
docker compose down -v        # remove o contêiner E apaga todos os dados
```

Os dados ficam no volume `dados-postgres` e sobrevivem a `stop`/`down`. O banco `pratocheio_test` é criado pelo script `docker/postgres-init/01-banco-de-testes.sql`, que roda **só quando o volume é criado**. Se você subiu o banco antes desse script existir e o `npm test` reclamar que `pratocheio_test` não existe, rode `docker compose down -v` e depois `docker compose up -d`.

**Problemas comuns:**
- `ECONNREFUSED 127.0.0.1:5432`: o banco não está de pé. Rode `docker compose up -d`.
- `port is already allocated` no `docker compose up`: outro PostgreSQL já usa a porta 5432. Pare esse outro ou troque a porta para `'5433:5432'` no `docker-compose.yml` e no `.env`.
- `Defina DATABASE_URL`: falta o `.env`. Rode `cp .env.example .env`.

O CI sobe um contêiner PostgreSQL próprio e define `DATABASE_URL` e `TEST_DATABASE_URL` automaticamente (`.github/workflows/ci.yml`).

## Estrutura

```
src/server.js        entrypoint (npm start)
src/db.js            conexão e schema do banco (pronto)
src/app.js           rotas da API
src/doacoes.js       regras de negócio      <- implementar (U1)
src/repositorio.js   acesso ao banco (SQL)  <- implementar (U1)
public/index.html    interface (funciona no celular)
tests/               testes automatizados
tests/app.test.js    verificação de saúde da aplicação
tests/auth.test.js   cadastro, login e permissões
tests/doacoes.test.js publicação, filtros, validade e validações
tests/coletas.test.js aceite, concorrência e cancelamento
tests/helpers.js     preparação do banco e dados de teste
docs/analise.md      documento de análise   (Trabalho 1)
docs/projeto.md      documento de projeto   (Trabalho 2)
docs/adr/            decisões arquiteturais (Trabalho 2)
docs/validacao.md    validação e testes     (Trabalho 3)
docs/refatoracoes.md refatorações feitas    (Trabalho 3)
docs/demo.md         roteiro da demo        (Trabalho 3)
docs/retrospectivas/ retrospectiva de cada iteração
.github/workflows/   pipeline de CI
```

## Como trabalhar (fluxo de Pull Request)

A partir da Unidade 2, **nada entra direto na `main`**:

```bash
git checkout -b historia/ong-aceita-doacao
# ... implementa, escreve o teste, roda npm test ...
git commit -m "ONG aceita uma doação e ela sai da lista"
git push -u origin historia/ong-aceita-doacao
```

Abra o Pull Request no GitHub, preencha o template, espere o **CI ficar verde** e
peça a revisão de **outro integrante**. Só então faça o merge.

## O que já está pronto e o que falta

Pronto: estrutura do projeto, interface básica, rota de saúde, **conexão com o banco e o schema** (`src/db.js`), CI configurado e um teste passando (prova que a aplicação sobe).

Falta (Trabalho 1 — walking skeleton): implementar `src/doacoes.js` (regras) e
`src/repositorio.js` (SQL) para que a história zero funcione ponta a ponta —
**um doador publica uma doação → uma ONG vê a doação → a ONG a aceita e ela sai da lista.**
Os critérios de aceite estão em `tests/doacoes.test.js` como `it.todo`: troque cada um
por um teste de verdade conforme implementa.

## Uso de IA

A IA pode participar da produção, mas o grupo é responsável por verificar, testar,
corrigir e **defender** o resultado. Registre em cada Pull Request o que foi gerado
com IA e o que vocês alteraram.
