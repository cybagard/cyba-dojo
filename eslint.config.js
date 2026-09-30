import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'public/apidoc/**', 'uploads/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^(req|res|next|_)' }],
    },
  },
  {
    // Test suites and root config files run under Node with ESM.
    files: ['test/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Portal glue: functions are invoked from inline HTML handlers, so
    // "unused" is expected here.
    files: ['public/portal/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
