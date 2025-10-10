import base, { createConfig } from '@metamask/eslint-config';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';
import jest from '@metamask/eslint-config-jest';

const config = createConfig([
  {
    ignores: ['dist/', 'docs/', '.yarn/'],
  },

  {
    extends: base,

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
    },
  },

  {
    files: ['**/*.ts'],
    extends: typescript,
    rules: {
      // TODO: resolve warnings and remove to make into errors
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'id-denylist': 'off',
      'id-length': 'off',
      'import/no-nodejs-modules': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-hyphen-before-param-description': 'warn',
      'jsdoc/match-description': 'warn',
      'jsdoc/no-types': 'warn',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'warn',
    },
  },

  {
    files: ['**/*.js', '**/*.cjs'],
    extends: nodejs,

    languageOptions: {
      sourceType: 'script',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.js'],
    extends: [jest, nodejs],
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/unbound-method': 'off',
      'jest/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            'expectProviderRequestNotToHaveBeenMade',
          ],
        },
      ],
      'jsdoc/check-param-names': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
    }
  },
]);

export default config;
