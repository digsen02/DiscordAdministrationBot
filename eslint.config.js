import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [{
  files: ['**/*.ts'],
  ignores: ['dist/**', 'drizzle/**'],
  languageOptions: { parser: tsparser, parserOptions: { project: './tsconfig.json' } },
  plugins: { '@typescript-eslint': tseslint },
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'error'
  }
}];
