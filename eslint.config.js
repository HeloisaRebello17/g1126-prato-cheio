import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Relatório gerado pelo `npm run test:cobertura`: não é código do projeto.
  { ignores: ['coverage/**'] },
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  },
  eslintConfigPrettier
];
