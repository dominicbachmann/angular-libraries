export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['angular-image-optimizer', 'repo']],
    'scope-empty': [2, 'never'],
  },
};
