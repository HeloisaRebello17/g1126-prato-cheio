# ADR 0001 — Adoção do Vitest para Testes Automatizados em Módulos ES Nativos

* **Data de Criação:** 2026-10-08
* **Data de Revisão:** 2026-10-08
* **Status:** Mantido (Revisado e Reavaliado diante da Expansão Multicidades)
* **Autores:** Equipe de Desenvolvimento Prato Cheio

---

## 1. Contexto Original

O projeto **Prato Cheio** utiliza Node.js na versão `22.13+` com suporte nativo a ES Modules (`"type": "module"` configurado no `package.json`)[cite: 5]. Toda a estrutura de código em `src/` utiliza sintaxe de `import`/`export` nativa sem etapas intermediárias de transpilação (Babel ou TypeScript)[cite: 8, 11, 12].

À medida que as regras de negócio em `src/doacoes.js`[cite: 10] e as rotas HTTP do Express em `src/app.js`[cite: 12] foram implementadas, surgiu a necessidade de integrar uma suíte de testes automatizados (`tests/doacoes.test.js`)[cite: 7]. Os requisitos fundamentais para o runner de testes eram:

1. **Injeção de Variáveis de Ambiente para Banco em Memória:** Garantir que os testes rodem utilizando o banco SQLite em memória (`DATABASE_FILE=":memory:"`)[cite: 3], isolando completamente os testes automatizados da base de dados física de desenvolvimento (`dados.sqlite`)[cite: 3, 4, 11].
2. **Suporte Transparente a ES Modules (ESM):** Testar o código-fonte exatamente como ele é executado pelo Node.js, sem necessidade de convertê-lo para CommonJS (`require`).
3. **Validação Rápida em Integração Contínua (CI):** Manter o tempo de resposta da esteira de validação no GitHub Actions (`.github/workflows/ci.yml`) em poucos segundos a cada *Pull Request*.
4. **Integração sem Atrito com Supertest:** Permitir o teste das rotas HTTP do Express simulando requisições de ponta a ponta sem necessidade de erguer portas HTTP reais[cite: 5, 7].

---

## 2. Alternativas Consideradas na Decisão Original

### Alternativa 1: Adotar o Jest
* **Vantagens:** Maturidade do ecossistema e ferramentas completas de *mocking* e cobertura embutidas.
* **Desvantagens:** Conflito nativo com `"type": "module"` (exige flags experimentais `NODE_OPTIONS` ou transpiladores) e tempo de execução elevado em CI[cite: 5].

### Alternativa 2: Adotar o Node Test Runner Nativo (`node:test`)
* **Vantagens:** Zero dependências externas no `package.json`.
* **Desvantagens:** Sintaxe de asserção mais verbosa e ausência de um arquivo de configuração simples (como o `vitest.config.js`)[cite: 3] para injetar dinamicamente `DATABASE_FILE=":memory:"`[cite: 3].

### Alternativa 3: Adotar o Vitest
* **Vantagens:** Suporte nativo e direto a ESM, configuração centralizada via `vitest.config.js`[cite: 3], execução paralela rápida pelo motor do Vite/Esbuild[cite: 5, 6] e sintaxe amigável compatível com Jest (`describe`, `it`, `expect`)[cite: 7].
* **Desvantagens:** Adição de dependências de desenvolvimento no ecossistema Vite/Esbuild[cite: 5, 6].

---

## 3. Decisão Original

A equipe decidiu **adotar o Vitest (Alternativa 3)** como o *test runner* padrão do **Prato Cheio**, motivada pela integração transparente com ES Modules e pela facilidade de isolar os testes com o banco SQLite em memória via `vitest.config.js`[cite: 3, 4].

---

## 4. Reavaliação e Mudança de Contexto

### Novo Cenário de Negócio
O sistema **Prato Cheio**, inicialmente desenvolvido para operar em um único bairro piloto[cite: 5, 19], expandiu seu escopo e passará a atender ONGs e doadores de **múltiplas cidades**, lidando com acessos simultâneos elevados e maior volume de doações em tempo real.

### Análise Crítica do Impacto no Runner de Testes

1. **Separação entre Arquitetura da Aplicação e Ferramental de Teste:**
   * O aumento do volume de acessos e a escala geográfica exigirão mudanças estruturais na **aplicação em produção** (como a migração do banco para PostgreSQL, introdução de índices de busca por localidade e tratamento de trava otimista em acessos concorrentes)[cite: 16].
   * No entanto, o **Vitest** é um *runner* do ambiente de desenvolvimento e CI/CD. Ele não roda no servidor do usuário final nem sofre os impactos diretos da carga do tráfego de produção[cite: 5, 6].

2. **Desempenho da Esteira de CI/CD sob Crescimento do Código:**
   * Com mais cidades e cenários complexos (filtros regionais, validação de latência e limites de concorrência), a suíte de testes em `tests/` crescerá consideravelmente[cite: 7].
   * A capacidade do Vitest de executar testes de forma paralela e ultrarrápida[cite: 5, 6] torna-se ainda **mais crítica** para evitar gargalos no pipeline do GitHub Actions à medida que o volume de arquivos de teste aumentar.

3. **Invariabilidade da Stack de Módulos (ESM):**
   * O código da aplicação continuará utilizando Node.js nativo com ES Modules (`"type": "module"`)[cite: 5]. O Vitest permanece sendo o executor mais eficiente para este ecossistema, sem requerer etapas de build ou transpilação intermediárias[cite: 5, 6].

---

## 5. Conclusão da Revisão

### Decisão: **MANTIDA**

A escolha do **Vitest** permanece **totalmente adequada** para o projeto **Prato Cheio**, mesmo no novo cenário de expansão nacional/multicidades.

### Resumo das Adequações para o Novo Cenário
* **Ferramenta:** Mantém-se o **Vitest** sem substituição[cite: 5, 6].
* **Evolução da Suíte de Testes:** A suíte de testes em `tests/` será expandida com novos arquivos focados em validar concorrência de acessos simultâneos e filtros por município/região[cite: 7].
* **Configuração:** O arquivo `vitest.config.js`[cite: 3] será mantido para testes em memória, podendo futuramente incluir configurações para contêineres de integração de banco de dados (Docker/PostgreSQL) mantendo o mesmo *runner*[cite: 3, 16].