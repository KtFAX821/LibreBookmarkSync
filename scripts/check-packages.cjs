// SPDX-License-Identifier: Apache-2.0

const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createRequire } = require('node:module');

const wxtRequire = createRequire(require.resolve('wxt'));
const JSZip = wxtRequire('jszip');

const root = process.cwd();
const outputDir = join(root, '.output');
const closedReleaseDirName = 'fohimdklhhcpcnpmmichieidclgfdmol';
const failures = [];

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(outputDir)) {
    fail('.output directory does not exist; run npm.cmd run zip and npm.cmd run zip:firefox first');
    report();
    return;
  }

  const zipFiles = readdirSync(outputDir)
    .filter(name => name.endsWith('.zip'))
    .sort();

  assert(zipFiles.some(name => /chrome\.zip$/i.test(name)), 'Chrome extension zip is missing');
  assert(zipFiles.some(name => /firefox\.zip$/i.test(name)), 'Firefox extension zip is missing');
  assert(zipFiles.some(name => /sources\.zip$/i.test(name)), 'Firefox sources zip is missing');

  for (const zipName of zipFiles) {
    await checkZip(zipName);
  }

  report();
}

async function checkZip(zipName) {
  const zipPath = join(outputDir, zipName);
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const entries = Object.keys(zip.files).sort();

  assert(entries.length > 0, `${zipName} must not be empty`);
  assertNoForbiddenEntries(zipName, entries);

  if (/sources\.zip$/i.test(zipName)) {
    await checkSourcesZip(zipName, zip, entries);
    return;
  }

  await checkExtensionZip(zipName, zip, entries);
}

async function checkExtensionZip(zipName, zip, entries) {
  for (const file of [
    'manifest.json',
    'background.js',
    'popup.html',
    'options.html',
    'icons/16.png',
    'icons/32.png',
    'icons/48.png',
    'icons/128.png',
    '_locales/en/messages.json',
    '_locales/zh_CN/messages.json',
  ]) {
    assert(entries.includes(file), `${zipName} is missing ${file}`);
  }

  await assertExtensionIconDimensions(zipName, zip);

  assert(entries.every(entry => !entry.startsWith('src/')), `${zipName} must not include source files`);
  assert(entries.every(entry => !entry.startsWith('docs/')), `${zipName} must not include docs files`);

  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert(manifest.name === '__MSG_extensionName__', `${zipName} manifest must use localized extension name`);
  assert(manifest.description === '__MSG_extensionDescription__', `${zipName} manifest must use localized extension description`);
  assert(manifest.default_locale === 'en', `${zipName} manifest default locale must be en`);

  if (/chrome\.zip$/i.test(zipName)) {
    assert(manifest.manifest_version === 3, `${zipName} must be Chrome MV3`);
    assert(manifest.background?.service_worker === 'background.js', `${zipName} must include MV3 service worker`);
    assert(manifest.action?.default_popup === 'popup.html', `${zipName} must expose popup through action`);
    assertOptionalStorageHostPermissions(zipName, manifest.optional_host_permissions || []);
    assertNoDefaultStorageHostPermissions(zipName, manifest);
  }

  if (/firefox\.zip$/i.test(zipName)) {
    assert(manifest.manifest_version === 2, `${zipName} must be Firefox MV2`);
    assert(
      Array.isArray(manifest.background?.scripts) && manifest.background.scripts.includes('background.js'),
      `${zipName} must include MV2 background script`,
    );
    assert(manifest.browser_action?.default_popup === 'popup.html', `${zipName} must expose popup through browser_action`);
    assertOptionalStorageHostPermissions(zipName, manifest.optional_permissions || []);
    assertNoDefaultStorageHostPermissions(zipName, manifest);
  }

  await assertNoForbiddenRuntimeStrings(zipName, zip, entries);
}

async function checkSourcesZip(zipName, zip, entries) {
  for (const file of [
    'LICENSE',
    'NOTICE',
    '.editorconfig',
    '.gitattributes',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'README.md',
    'README_cn.md',
    'tsconfig.json',
    'tsconfig.tests.json',
    'wxt.config.ts',
    'src/assets/icon.svg',
    'src/entrypoints/background.ts',
    'src/entrypoints/options/options.tsx',
    'src/entrypoints/popup/popup.tsx',
    'src/bookmarks/bookmarkTree.ts',
    'src/crypto/encryption.ts',
    'src/diagnostics/diagnosticMail.ts',
    'src/diagnostics/diagnosticReport.ts',
    'src/history/bookmarkSnapshotData.ts',
    'src/history/bookmarkSnapshots.ts',
    'src/history/syncHistory.ts',
    'src/settings/appSettings.ts',
    'src/settings/encryptionSettings.ts',
    'src/settings/settingNormalization.ts',
    'src/utils/extensionAction.ts',
    'src/utils/i18n.ts',
    'src/utils/runtimeMessages.ts',
    'src/storage/gistAdapter.ts',
    'src/storage/gistPermissions.ts',
    'src/storage/storageFactory.ts',
    'src/storage/testStorageConnection.ts',
    'src/storage/webdavAdapter.ts',
    'src/sync/autoSync.ts',
    'src/sync/autoSyncConflict.ts',
    'src/sync/autoSyncSchedule.ts',
    'src/sync/bookmarkMerge.ts',
    'src/sync/safety.ts',
    'src/sync/syncDocument.ts',
    'src/sync/syncState.ts',
    'src/public/_locales/en/messages.json',
    'src/public/_locales/zh_CN/messages.json',
    'tests/autoSyncConflict.test.ts',
    'tests/autoSyncSchedule.test.ts',
    'tests/bookmarkMerge.test.ts',
    'tests/bookmarkTree.test.ts',
    'tests/bookmarkSnapshotData.test.ts',
    'tests/diagnosticMail.test.ts',
    'tests/diagnosticReport.test.ts',
    'tests/encryptionSettings.test.ts',
    'tests/gistAdapter.test.ts',
    'tests/gistPermissions.test.ts',
    'tests/runtimeMessages.test.ts',
    'tests/safety.test.ts',
    'tests/settingNormalization.test.ts',
    'tests/storageFactory.test.ts',
    'tests/testStorageConnection.test.ts',
    'tests/syncDocument.test.ts',
    'tests/syncHistory.test.ts',
    'tests/syncState.test.ts',
    'tests/webdavAdapter.test.ts',
    'tests/webdavPermissions.test.ts',
    'tests/runtime-package.json',
    'scripts/chrome-runtime-smoke.cjs',
    'scripts/launch-smoke-test.cjs',
    'scripts/analyze-bookmark-export.cjs',
    'scripts/github-publishing-rules.cjs',
    'scripts/list-github-publish-files.cjs',
    'scripts/prepare-github-publish-source.cjs',
    'scripts/run-merge-tests.cjs',
    'scripts/check-docs.cjs',
    'scripts/check-github-publishing.cjs',
    'scripts/check-release.cjs',
    'scripts/check-locales.cjs',
    'scripts/check-ui-style.cjs',
    'scripts/check-runtime-preflight.cjs',
    'scripts/check-packages.cjs',
    'scripts/verify-release.cjs',
    'docs/GITHUB_PUBLISHING.md',
    'docs/IMPLEMENTATION_PLAN.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/RUNTIME_SMOKE_TESTS.md',
    'docs/RUNTIME_SMOKE_TESTS_cn.md',
    'docs/RUNTIME_SMOKE_REPORT_TEMPLATE.md',
    'docs/PRIVACY.md',
    'docs/PERMISSIONS.md',
    'docs/THIRD_PARTY_LICENSES.md',
  ]) {
    assert(entries.includes(file), `${zipName} is missing source file ${file}`);
  }

  assert(entries.every(entry => !entry.startsWith('.output/')), `${zipName} must not include .output`);
  assert(entries.every(entry => !entry.startsWith('.tmp/')), `${zipName} must not include .tmp`);
  assert(entries.every(entry => !entry.startsWith('node_modules/')), `${zipName} must not include node_modules`);
  assert(entries.every(entry => !entry.startsWith('assets/')), `${zipName} must not include root assets/ leftovers`);
  assert(entries.every(entry => !entry.startsWith('images/')), `${zipName} must not include root images/ leftovers`);
  assert(!entries.includes('docs/HANDOFF.md'), `${zipName} must not include local handoff notes`);
  assert(entries.every(entry => !entry.startsWith('docs/superpowers/')), `${zipName} must not include local design-process notes`);
  await assertIconSource(zipName, zip);
  await assertNoDirectBrowserActionApi(zipName, zip, entries);
  await assertNoDirectRuntimeSendMessage(zipName, zip, entries);
  await assertNoForbiddenRuntimeStrings(zipName, zip, entries, entry => entry.startsWith('src/'));
}

async function assertExtensionIconDimensions(zipName, zip) {
  for (const size of [16, 32, 48, 128]) {
    const entry = `icons/${size}.png`;
    const png = await zip.file(entry).async('uint8array');
    const dimensions = readPngDimensions(png);
    assert(dimensions.width === size, `${zipName} ${entry} width must be ${size}px, got ${dimensions.width}px`);
    assert(dimensions.height === size, `${zipName} ${entry} height must be ${size}px, got ${dimensions.height}px`);
  }
}

async function assertIconSource(zipName, zip) {
  const icon = await zip.file('src/assets/icon.svg').async('string');
  assert(/<svg\b/i.test(icon), `${zipName} src/assets/icon.svg must be SVG`);
  assert(!/<!DOCTYPE/i.test(icon), `${zipName} src/assets/icon.svg must not declare an external SVG DTD`);
  assert(/\bviewBox=["']0 0 512 512["']/i.test(icon), `${zipName} src/assets/icon.svg must use a square 512x512 viewBox`);
}

function assertOptionalStorageHostPermissions(label, optionalPermissions) {
  for (const permission of [
    'https://api.github.com/*',
    'https://gist.githubusercontent.com/*',
    '*://*/*',
  ]) {
    assert(
      optionalPermissions.includes(permission),
      `${label} must include optional storage host permission ${permission}`,
    );
  }
}

function assertNoDefaultStorageHostPermissions(label, manifest) {
  const defaultPermissions = [
    ...(manifest.permissions || []),
    ...(manifest.host_permissions || []),
  ];

  for (const permission of [
    'https://api.github.com/*',
    'https://gist.githubusercontent.com/*',
    'https://*.github.com/',
    'https://*.githubusercontent.com/',
    '*://*/*',
  ]) {
    assert(
      !defaultPermissions.includes(permission),
      `${label} must not request storage host permission by default: ${permission}`,
    );
  }
}

function assertNoForbiddenEntries(zipName, entries) {
  const forbiddenEntryPatterns = [
    { pattern: new RegExp(`^${closedReleaseDirName}(/|$)`, 'i'), label: closedReleaseDirName },
    { pattern: /^\.git(\/|$)/i, label: '.git' },
    { pattern: /^\.wxt(\/|$)/i, label: '.wxt' },
  ];

  for (const entry of entries) {
    for (const { pattern, label } of forbiddenEntryPatterns) {
      assert(!pattern.test(entry), `${zipName} must not include ${label}: ${entry}`);
    }
  }
}

async function assertNoForbiddenRuntimeStrings(zipName, zip, entries, shouldCheckEntry = () => true) {
  const forbiddenPatterns = [
    { pattern: /memoload\.com/i, label: 'memoload.com' },
    { pattern: /\bBookmarkHub\b/i, label: 'BookmarkHub runtime brand' },
    { pattern: /dudor\/BookmarkHub/i, label: 'original repository runtime link' },
    { pattern: /fohimdklhhcpcnpmmichieidclgfdmol/i, label: 'closed Chrome extension ID' },
    { pattern: /\bsentry\b/i, label: 'Sentry' },
    { pattern: /license[_-]?key/i, label: 'license key' },
    { pattern: /\b(create\s+account|sign\s*in|sign\s*up|signin|signup|log\s*in|login)\b/i, label: 'login/signup UI' },
    { pattern: /\b(register|registration)\s+(account|user)\b/i, label: 'account registration UI' },
    { pattern: /\b(trial|paid|payment|billing|pricing)\b/i, label: 'paid/trial/billing UI' },
    { pattern: /\bsubscription\b(?!-free)/i, label: 'subscription UI' },
    { pattern: /\bpremium\b/i, label: 'premium' },
    { pattern: /\bpro[_-]?(tier|plan|feature|status|license)\b/i, label: 'Pro tier/plan/feature/status/license' },
    { pattern: /\bentitlement\b/i, label: 'entitlement state' },
    { pattern: /\bsubscription[_-]?(id|status|plan|tier)\b/i, label: 'subscription entitlement state' },
  ];

  const textExtensions = /\.(c?js|mjs|json|html|css|tsx?|md|txt|svg)$/i;
  for (const entry of entries.filter(name => shouldCheckEntry(name) && textExtensions.test(name))) {
    const content = await zip.file(entry).async('string');
    for (const { pattern, label } of forbiddenPatterns) {
      if (pattern.test(content)) {
        fail(`${zipName} contains forbidden runtime string (${label}) in ${entry}`);
      }
    }
  }
}

async function assertNoDirectBrowserActionApi(zipName, zip, entries) {
  const directActionApiPattern = /\bbrowser\.(action|browserAction)\b/;
  const compatibilityLayer = 'src/utils/extensionAction.ts';
  for (const entry of entries.filter(name => name.startsWith('src/') && /\.(tsx?|jsx?)$/i.test(name))) {
    if (entry === compatibilityLayer) {
      continue;
    }

    const content = await zip.file(entry).async('string');
    if (directActionApiPattern.test(content)) {
      fail(`${zipName} direct browser action API usage must go through ${compatibilityLayer}: ${entry}`);
    }
  }
}

async function assertNoDirectRuntimeSendMessage(zipName, zip, entries) {
  const directRuntimeSendPattern = /\bbrowser\.runtime\.sendMessage\b/;
  const runtimeMessageHelper = 'src/utils/runtimeMessages.ts';
  for (const entry of entries.filter(name => name.startsWith('src/') && /\.(tsx?|jsx?)$/i.test(name))) {
    if (entry === runtimeMessageHelper) {
      continue;
    }

    const content = await zip.file(entry).async('string');
    if (directRuntimeSendPattern.test(content)) {
      fail(`${zipName} runtime sendMessage usage must go through ${runtimeMessageHelper}: ${entry}`);
    }
  }
}

function readPngDimensions(png) {
  const expectedSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < expectedSignature.length; index += 1) {
    assert(png[index] === expectedSignature[index], 'icon file must be a PNG');
  }

  const chunkType = String.fromCharCode(png[12], png[13], png[14], png[15]);
  assert(chunkType === 'IHDR', 'icon PNG must have an IHDR chunk');

  return {
    width: readUInt32BE(png, 16),
    height: readUInt32BE(png, 20),
  };
}

function readUInt32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
  );
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  failures.push(message);
}

function report() {
  if (failures.length > 0) {
    console.error('Package checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('package checks passed');
}
