import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['src/sim/**/*.ts'],
  rules: {
    'no-restricted-globals': ['error', 'window', 'document'],
    'no-restricted-properties': ['error', { object: 'Math', property: 'random' }],
    'no-restricted-imports': ['error', { patterns: ['phaser', '../render/*'] }],
  },
});
