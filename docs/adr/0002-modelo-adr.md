# ADR 0001 — Adoção do Vitest para Testes Automatizados em Módulos ES Nativos

* **Data:** 2026-10-08
* **Status:** Aprovado
* **Autores:** Equipe de Desenvolvimento Prato Cheio

---

## 1. Contexto

O projeto **Prato Cheio** utiliza Node.js na versão `22.13+` com suporte nativo a ES Modules (`"type": "module"` configurado no `package.json`[cite: 5]). Toda a estrutura de código em `src/` utiliza sintaxe de `import`/`export` nativa sem etapas intermediárias de transpilação (Babel ou TypeScript)[cite: 8, 11, 12].

À medida que as regras de negócio em `src/doacoes.js`[cite: 10] e as rotas HTTP do Express em `src/app.js`[cite: 12] foram implementadas, surgiu a necessidade de integrar uma suíte de testes automatizados (`tests/doacoes.test.js`)[cite: 7]. Os requisitos fundamentais para o runner de testes eram:

1. **Injeção de Variáveis de Ambiente para Banco em Memória:** Garantir que os testes rodem utilizando o banco SQLite em memória (`DATABASE_FILE=":memory:"`)[cite: 3], isolando completamente os testes automatizados da base de dados física de desenvolvimento (`dados.sqlite`)[cite: 3, 4, 11].
2. **Suporte Transparente a ES Modules (ESM):** Testar o código-fonte exatamente como ele é executado pelo Node.js, sem necessidade de convertê-lo para CommonJS (`require`).
3. **Validação Rápida em Integração Contínua (CI):** Manter o tempo de resposta da esteira de validação no GitHub Actions (`.github/workflows/ci.yml`) em poucos segundos a cada *Pull Request*.
4. **Integração sem Atrito com Supertest:** Permitir o teste das rotas HTTP do Express simulando requisições de ponta a ponta sem necessidade de erguer portas HTTP reais[cite: 5, 7].

---

## 2. Alternativas Consideradas

### Alternativa 1: Adotar o Jest

Utilizar o Jest, tradicionalmente o executor de testes mais popular no ecossistema Node.js.

* **Vantagens:**
  * **Maturidade e Ecossistema:** Ampla documentação e ecossistema consolidado de plugins.
  * **Ferramental Completo:** Já inclui biblioteca de mocks, spies e geradores de relatórios de cobertura.
* **Desvantagens no Contexto do Projeto:**
  * **Conflito Nativo com ESM (`"type": "module"`):** O Jest foi construído sobre o ecossistema CommonJS (`require`). Fazer o Jest executar arquivos ESM nativos exige passar a flag experimental do Node (`NODE_OPTIONS=--experimental-vm-modules`) ou adicionar dependências pesadas de transpilação (`babel-jest` ou `@swc/jest`).
  * **Lentidão em Projetos Leves:** O tempo de inicialização da VM do Jest para isolar cada suíte de teste consome tempo relevante no ambiente de CI.
  * **Avisos Experimentais Adicionais:** A convivência com o módulo nativo `node:sqlite` do Node 22[cite: 4, 11] gerava *warnings* e falhas de resolução de módulo interno no ecossistema do Jest.

---

### Alternativa 2: Adotar o Node Test Runner Nativo (`node:test`)

Utilizar o módulo de testes embutido do próprio Node.js (`node:test` e `node:assert`).

* **Vantagens:**
  * **Zero Dependências Dev:** Não exige instalar pacotes extras no `package.json`.
  * **Execução Rápida:** Carregamento ultra-rápido feito diretamente pela VM do Node.
* **Desvantagens no Contexto do Projeto:**
  * **Sintaxe de Asserções Verbosa:** A biblioteca `node:assert` possui uma sintaxe menos expressiva para testes de integração de API do que o encadeamento de expectativas no estilo `expect(res.body).toHaveLength(1)`[cite: 7].
  * **Configuração de Ambiente Rígida:** Não possui um arquivo de configuração centralizado e elegante (como o `vitest.config.js`)[cite: 3] para injetar dinamicamente variáveis de ambiente como `DATABASE_FILE=":memory:"`[cite: 3] antes da inicialização dos arquivos de teste.

---

### Alternativa 3: Adotar o Vitest

Utilizar o Vitest, um executor de testes de nova geração projetado nativamente para lidar com ES Modules e alimentado pelo motor do Vite/Esbuild[cite: 5, 6].

* **Vantagens:**
  * **Suporte Nativo e Transparente a Módulos ES:** Entende a sintaxe `import`/`export` sem nenhuma ferramenta de transpilação intermediária.
  * **Configuração Simples via `vitest.config.js`:** Permite definir a variável de ambiente `DATABASE_FILE: ':memory:'`[cite: 3] em poucas linhas de código, garantindo que `src/db.js`[cite: 11] suba o banco em memória automaticamente ao executar `npm test`[cite: 4, 5].
  * **Sintaxe Fluida Compatível com Jest:** Disponibiliza globalmente ou via importação funções estruturais como `describe`, `it`, `expect`, `beforeEach` e `afterAll`[cite: 7], tornando os testes simples e legíveis.
  * **Alta Performance com Execução Paralela:** Executa os testes de integração com `supertest`[cite: 5] instantaneamente.
* **Desvantagens no Contexto do Projeto:**
  * **Dependência do Pacote `vite` como Transpiler Subjacente:** Adiciona pacotes dev em `package.json`[cite: 5, 6].

---

## 3. Decisão

A equipe decidiu **adotar o Vitest (Alternativa 3)** como o *test runner* padrão do **Prato Cheio**.

### Motivação

O Vitest resolve diretamente as limitações encontradas no Jest ao trabalhar com `"type": "module"`[cite: 5]. Ele eliminou a necessidade de incluir ferramentas de build como Babel, mantendo o projeto simples e leve. A injeção automática de `DATABASE_FILE: ':memory:'` através do `vitest.config.js`[cite: 3] permitiu isolar perfeitamente o banco de testes em memória sem poluir ou sobrescrever o banco local de desenvolvimento (`dados.sqlite`)[cite: 3, 4].

---

## 4. Consequências

### O que ganhamos (Pontos Positivos)

1. **Zero Transpilação:** O código testado é o exato código JavaScript que roda no ambiente de produção do Express[cite: 8, 12].
2. **Isolamento de Banco de Dados Garantido:** Através da configuração do Vitest, o script `npm test`[cite: 5] roda inteiramente em memória SQLite[cite: 3, 4], permitindo que `beforeEach(async () => { await migrar(); await limparBanco(); })`[cite: 7] resete a base a cada teste de forma limpa e ultra-rápida.
3. **Integração Perfeita com o Pipeline de CI:** No GitHub Actions, os testes executam em poucos segundos, acelerando o ciclo de code review e merge de PRs.
4. **Sintaxe Clara de Asserção:** Compatibilidade com o ecossistema `supertest`[cite: 5] para asserções diretas de HTTP (`expect(res.status).toBe(200)`)[cite: 7].

### O que perdemos / Desafios (Pontos Negativos)

1. **Dependências Dev Adicionais:** Aumento na árvore de dependências dev (`vitest` e `vite` no `package.json` e `package-lock.json`)[cite: 5, 6].
2. **Alertas de Recursos Experimentais do Node:** Ao executar `npm test`, o Node 22 imprime o aviso `ExperimentalWarning: SQLite is an experimental feature`[cite: 4] ao carregar `node:sqlite` via `createRequire` em `src/db.js`[cite: 11] (comportamento contido e esperado que não afeta o resultado dos testes)[cite: 4].