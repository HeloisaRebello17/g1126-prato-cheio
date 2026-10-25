# 1. Adoção do Vitest para Testes Automatizados no Ecossistema ES Modules

* **Data:** 2026-10-08
* **Status:** Aprovado
* **Autores:** Equipe de Desenvolvimento Prato Cheio

## Contexto

O projeto **Prato Cheio** foi estruturado utilizando Node.js moderno com **ES Modules (ESM)** nativo (definido via `"type": "module"` no `package.json`), alinhado aos padrões atuais do ecossistema JavaScript.

À medida que a suíte de testes em `tests/doacoes.test.js` e as regras de negócio em `src/doacoes.js` foram evoluindo, surgiu a necessidade de definir o framework de testes que oferecesse suporte nativo a ESM, alta performance em rotinas de CI/CD e configuração simples sem necessidade de transpilação excessiva (como Babel).

A escolha do runner de testes impacta diretamente a velocidade de execução na esteira do GitHub Actions (`.github/workflows/ci.yml`) e a produtividade no desenvolvimento local.

## Alternativas Consideradas

### Alternativa 1: Adotar o Jest

Utilizar o Jest, que é a ferramenta tradicionalmente mais popular para testes em Node.js.

* **Vantagens:**
  * **Ampla adoção e maturidade:** Ecossistema grande, vasta documentação e comunidades ativas.
  * **Recursos embutidos completos:** Asserções, mocks e relatórios de cobertura prontos para uso.
* **Desvantagens:**
  * **Suporte a ES Modules experimental/complexo:** O Jest depende de flags de execução (`NODE_OPTIONS=--experimental-vm-modules`) ou de transpiladores (Babel/ts-jest) para lidar adequadamente com suporte nativo a `import/export`.
  * **Maior tempo de inicialização e execução:** Performance de execução de testes mais lenta comparada a runners modernos baseados em Vite/Esbuild.

### Alternativa 2: Adotar o Vitest

Utilizar o Vitest (`vitest.config.js`), um runner moderno projetado nativamente para ambientes ESM.

* **Vantagens:**
  * **Suporte nativo e transparente a ES Modules:** Funciona imediatamente com o padrão de módulos do Node.js sem necessidade de babel/transpilação adicional.
  * **Alta performance e execução paralela:** Desenvolvido sobre o `vite`/`esbuild`, oferecendo tempos de inicialização e re-execução (watch mode) significativamente menores.
  * **Compatibilidade de API com Jest:** Utiliza sintaxes familiares (`describe`, `test`, `expect`, `vi.fn()`), facilitando a curva de aprendizado da equipe.
* **Desvantagens:**
  * **Comunidade menor se comparada ao Jest:** Embora esteja em crescimento acelerado, possui menos histórico acumulado em fóruns legados.
  * **Dependência do ecossistema Vite:** Requer atenção na compatibilidade ao interagir com pacotes legados CommonJS antigos.

## Decisão

A equipe decidiu **adotar o Vitest (Alternativa 2)** como framework oficial de testes do projeto Prato Cheio.

### Motivação

O projeto Prato Cheio adota ES Modules nativo no Node.js. O Vitest integra-se a esse ecossistema sem necessitar de configurações complexas de compilação ou flags experimentais do Node, reduzindo o custo de manutenção de build. Além disso, a sua performance reduz o tempo de execução do workflow de CI no GitHub Actions (`ci.yml`), acelerando o feedback para os desenvolvedores.

## Consequências

### O que ganhamos (Pontos Positivos)

* **Zero configuração para ESM:** A suíte de testes executa nativamente arquivos que utilizam `import/export` sem etapas intermediárias de *build*.
* **Esteira de CI/CD mais veloz:** Testes mais rápidos no GitHub Actions garantem validações frequentes a cada Pull Request.
* **Sintaxe padrão e amigável:** A sintaxe de asserções em `tests/doacoes.test.js` mantém-se legível e intuitiva.

### O que perdemos / Desafios (Pontos Negativos)

* **Adaptação de utilitários de Mock:** É necessário utilizar utilitários próprios do Vitest (`vi.fn()`, `vi.spyOn()`) em vez dos equivalentes globais do Jest (`jest.fn()`).
* **Necessidade de arquivo de configuração dedicado:** Adição do arquivo `vitest.config.js` na raiz do projeto para personalizar limites de cobertura e opções do runner.