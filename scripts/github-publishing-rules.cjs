// SPDX-License-Identifier: Apache-2.0

const requiredPublishPaths = [
  'src/',
  'scripts/',
  'tests/',
  'docs/GITHUB_PUBLISHING.md',
  'docs/IMPLEMENTATION_PLAN.md',
  'docs/PERMISSIONS.md',
  'docs/PRIVACY.md',
  'docs/RELEASE_CHECKLIST.md',
  'docs/RUNTIME_SMOKE_REPORT_TEMPLATE.md',
  'docs/RUNTIME_SMOKE_TESTS.md',
  'docs/RUNTIME_SMOKE_TESTS_cn.md',
  'docs/THIRD_PARTY_LICENSES.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tsconfig.tests.json',
  'wxt.config.ts',
  'README.md',
  'README_cn.md',
  'LICENSE',
  'NOTICE',
  '.gitignore',
  '.editorconfig',
  '.gitattributes',
];

const forbiddenPublishPaths = [
  'node_modules/',
  '.pnpm-store/',
  '.output/',
  '.wxt/',
  '.tmp/',
  'fohimdklhhcpcnpmmichieidclgfdmol/',
  'assets/',
  'images/',
  'docs/HANDOFF.md',
  'docs/superpowers/',
  'stats.html',
  'stats-*.json',
];

module.exports = {
  forbiddenPublishPaths,
  requiredPublishPaths,
};
