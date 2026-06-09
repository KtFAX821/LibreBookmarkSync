// SPDX-License-Identifier: Apache-2.0

const { existsSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = process.cwd();
const failures = [];

const publicDocs = [
  'README.md',
  'README_cn.md',
  'docs/PRIVACY.md',
  'docs/PERMISSIONS.md',
  'docs/IMPLEMENTATION_PLAN.md',
  'docs/RELEASE_CHECKLIST.md',
  'docs/GITHUB_PUBLISHING.md',
  'docs/RUNTIME_SMOKE_REPORT_TEMPLATE.md',
  'docs/RUNTIME_SMOKE_TESTS.md',
  'docs/RUNTIME_SMOKE_TESTS_cn.md',
  'docs/THIRD_PARTY_LICENSES.md',
];

for (const doc of publicDocs) {
  checkReadableDocument(doc);
}

checkEnglishReadme();
checkChineseReadme();
checkReadmesDoNotReferenceLocalOnlyDocs();
checkImplementationPlan();
checkRuntimeSmokeDocs();

if (failures.length > 0) {
  console.error('Documentation checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('documentation checks passed');
}

function checkReadableDocument(path) {
  const content = readText(path);
  assert(content.length > 0, `${path} must not be empty`);

  const mojibakePatterns = [
    { pattern: /[\u93c4\u7d1d\u9422\u6d49\u93c8\u95c2\u7ee8\u9365\u74a7\u92ae\u95ab\u9411]/u, label: 'common UTF-8 mojibake' },
    { pattern: /\u6b5adocs\//u, label: 'broken markdown path prefix' },
  ];

  for (const { pattern, label } of mojibakePatterns) {
    assert(!pattern.test(content), `${path} appears to contain ${label}`);
  }
}

function checkEnglishReadme() {
  const readme = readText('README.md');
  for (const requiredText of [
    'accountless open-source browser extension',
    'WebDAV storage backend by default',
    'Optional GitHub Gist compatibility backend',
    'no login, no subscription, no Pro tier, no license key',
    'No copied code or assets from closed store-distributed releases',
  ]) {
    assert(readme.includes(requiredText), `README.md must include: ${requiredText}`);
  }
}

function checkChineseReadme() {
  const readme = readText('README_cn.md');
  for (const requiredText of [
    '\u65e0\u8d26\u53f7\u3001\u5f00\u6e90\u3001\u672c\u5730\u4f18\u5148',
    '\u9ed8\u8ba4\u4f7f\u7528 WebDAV \u5b58\u50a8\u540e\u7aef',
    '\u53ef\u9009\u4fdd\u7559 GitHub Gist \u517c\u5bb9\u540e\u7aef',
    '\u6ca1\u6709\u767b\u5f55\u3001\u8ba2\u9605\u3001\u4e13\u4e1a\u7248\u3001\u8bb8\u53ef\u8bc1\u5bc6\u94a5',
    '\u4e0d\u590d\u5236\u95ed\u6e90\u5546\u5e97\u53d1\u884c\u7248\u4e2d\u7684\u4ee3\u7801\u6216\u8d44\u6e90',
  ]) {
    assert(readme.includes(requiredText), `README_cn.md must include required Chinese release statement`);
  }
}

function checkReadmesDoNotReferenceLocalOnlyDocs() {
  for (const doc of ['README.md', 'README_cn.md']) {
    const readme = readText(doc);
    for (const localOnlyPath of ['docs/HANDOFF.md', 'docs/superpowers/']) {
      assert(
        !readme.includes(localOnlyPath),
        `${doc} must not reference local-only handoff/design path ${localOnlyPath}`,
      );
    }
  }
}

function checkImplementationPlan() {
  const plan = readText('docs/IMPLEMENTATION_PLAN.md');
  for (const requiredText of [
    '## Current Status',
    'Milestones 1 through 7 have first-pass local implementations',
    'npm.cmd run verify:release',
    'Runtime test reports and handoff notes are local-only records',
    'Do not publish `docs/HANDOFF.md`, `docs/superpowers/`',
    'Status: first-pass implemented',
    'browser-store submission review remains',
  ]) {
    assert(plan.includes(requiredText), `docs/IMPLEMENTATION_PLAN.md must include: ${requiredText}`);
  }
}

function checkRuntimeSmokeDocs() {
  const english = readText('docs/RUNTIME_SMOKE_TESTS.md');
  for (const requiredText of [
    'browser extension runtime',
    'not a website or app server',
    '.output/chrome-mv3',
    '.output/firefox-mv2/manifest.json',
    'Live Syncable Local Count',
  ]) {
    assert(english.includes(requiredText), `docs/RUNTIME_SMOKE_TESTS.md must include: ${requiredText}`);
  }

  const chinese = readText('docs/RUNTIME_SMOKE_TESTS_cn.md');
  for (const requiredText of [
    '\u771f\u5b9e\u6d4f\u89c8\u5668\u6d4b\u8bd5\u6e05\u5355',
    '\u4e0d\u662f\u7f51\u7ad9\u6d4b\u8bd5',
    '.output\\chrome-mv3',
    '.output\\firefox-mv2\\manifest.json',
    'Live Syncable Local Count',
    '\u4e0d\u8981\u53d1\u9001 WebDAV \u5bc6\u7801',
  ]) {
    assert(chinese.includes(requiredText), `docs/RUNTIME_SMOKE_TESTS_cn.md must include required Chinese smoke-test text`);
  }
}

function readText(path) {
  const resolved = join(root, path);
  if (!existsSync(resolved)) {
    fail(`missing document: ${path}`);
    return '';
  }

  try {
    return readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    fail(`could not read ${relative(root, resolved)}: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  failures.push(message);
}
