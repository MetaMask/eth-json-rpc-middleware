module.exports = {
  // env: {
  //   browser: true,
  //   commonjs: true,
  //   es6: true,
  // },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/nodejs',
  ],
  plugins: [
    'json',
  ],
  rules: {
    'no-plusplus': ['error', { 'allowForLoopAfterthoughts': true }],
  },
  ignorePatterns: [
    '!.eslintrc.js',
    'node_modules/',
  ],
}
