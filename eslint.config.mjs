import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...next,
  ...nextTs,
  {
    rules: {
      // `const { blob, ...info } = song` is how a field is left out.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['.next/**', 'out/**', 'public/**', 'next-env.d.ts'] },
];

export default config;
