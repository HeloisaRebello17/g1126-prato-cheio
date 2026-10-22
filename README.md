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

## Como rodar

Requisitos: **Node.js 22.13 ou superior** e um **PostgreSQL** acessível pela variável `DATABASE_URL`.

> Esta é a **stack preferencial** da disciplina. Se o seu grupo optar por outra, registre o ADR de justificativa e garanta os mesmos compromissos: repositório público com CI verde, rota de saúde, testes por um comando, os três comandos documentados aqui no README e banco relacional em PostgreSQL.

**Banco local com Docker (recomendado):**

```bash
docker compose up -d          # sobe PostgreSQL na porta 5432
cp .env.example .env          # Windows: copy .env.example .env
npm install                   # só na primeira vez
npm run db:migrar             # cria o schema
npm start                     # sobe em http://localhost:3001
npm test                      # roda os testes (usa o mesmo DATABASE_URL)
npm run dev                   # sobe recarregando a cada alteração
```

Sem Docker, instale PostgreSQL na máquina ou use um serviço gratuito (Neon, Supabase, Render) e aponte `DATABASE_URL` no `.env`.

## O banco: PostgreSQL

O `src/db.js` concentra a conexão (`pg` + `DATABASE_URL`) e expõe `query()` devolvendo `{ rows }`. O SQL do repositório continua usando `?` como marcador; a conversão para `$1`, `$2`, … fica só no `db.js`.

| Caminho | Quando usar |
|---|---|
| `docker compose up -d` | desenvolvimento e testes locais (credenciais em `.env.example`) |
| PostgreSQL instalado / serviço na nuvem | produção ou se o grupo preferir no ADR |

O CI sobe um contêiner PostgreSQL e define `DATABASE_URL` automaticamente (`.github/workflows/ci.yml`).

## Estrutura

```
src/server.js        entrypoint (npm start)
src/db.js            conexão e schema do banco (pronto)
src/app.js           rotas da API
src/doacoes.js       regras de negócio      <- implementar (U1)
src/repositorio.js   acesso ao banco (SQL)  <- implementar (U1)
public/index.html    interface (funciona no celular)
tests/               testes automatizados
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
