// SPDX-License-Identifier: Apache-2.0

const { existsSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = process.cwd();
const failures = [];

const targets = [
  {
    name: 'Chrome MV3',
    outputDir: join(root, '.output', 'chrome-mv3'),
    manifestVersion: 3,
  },
  {
    name: 'Firefox MV2',
    outputDir: join(root, '.output', 'firefox-mv2'),
    manifestVersion: 2,
  },
];

for (const target of targets) {
  checkTarget(target);
}

if (failures.length > 0) {
  console.error('Runtime preflight checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('runtime preflight checks passed');
}

function checkTarget(target) {
  assert(existsSync(target.outputDir), `${target.name} output directory is missing`);

  const manifestPath = join(target.outputDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  const popupPage = target.manifestVersion === 3
    ? manifest.action?.default_popup
    : manifest.browser_action?.default_popup;
  const optionsPage = manifest.options_ui?.page;

  checkManifestRuntimeShape(target, manifest);
  checkBackgroundRuntime(target, manifest);
  checkHtmlEntrypoint(target, popupPage, 'popup');
  checkHtmlEntrypoint(target, optionsPage, 'options');
  checkLocaleRuntime(target, manifest);
}

function checkManifestRuntimeShape(target, manifest) {
  assert(manifest.manifest_version === target.manifestVersion, `${target.name} manifest version mismatch`);
  assert(manifest.name === '__MSG_extensionName__', `${target.name} manifest must use localized extension name`);
  assert(manifest.description === '__MSG_extensionDescription__', `${target.name} manifest must use localized extension description`);

  if (target.manifestVersion === 3) {
    assert(manifest.background?.service_worker === 'background.js', `${target.name} must load background.js as an MV3 service worker`);
    assert(manifest.action?.default_popup === 'popup.html', `${target.name} must expose popup.html through action`);
    assert(!manifest.browser_action, `${target.name} must not include MV2 browser_action`);
    assert(Array.isArray(manifest.optional_host_permissions), `${target.name} must expose storage hosts through optional_host_permissions`);
    assert(manifest.optional_host_permissions.includes('https://api.github.com/*'), `${target.name} must expose optional GitHub Gist API permission`);
    assert(manifest.optional_host_permissions.includes('https://gist.githubusercontent.com/*'), `${target.name} must expose optional raw Gist permission`);
    assert(manifest.optional_host_permissions.includes('*://*/*'), `${target.name} must expose optional WebDAV permission`);
    assert(!manifest.optional_permissions, `${target.name} must not use MV2 optional_permissions`);
    return;
  }

  assert(
    Array.isArray(manifest.background?.scripts) && manifest.background.scripts.includes('background.js'),
    `${target.name} must load background.js through MV2 background.scripts`,
  );
  assert(manifest.browser_action?.default_popup === 'popup.html', `${target.name} must expose popup.html through browser_action`);
  assert(!manifest.action, `${target.name} must not include MV3 action`);
  assert(Array.isArray(manifest.optional_permissions), `${target.name} must expose storage hosts through optional_permissions`);
  assert(manifest.optional_permissions.includes('https://api.github.com/*'), `${target.name} must expose optional GitHub Gist API permission`);
  assert(manifest.optional_permissions.includes('https://gist.githubusercontent.com/*'), `${target.name} must expose optional raw Gist permission`);
  assert(manifest.optional_permissions.includes('*://*/*'), `${target.name} must expose optional WebDAV permission`);
  assert(!manifest.optional_host_permissions, `${target.name} must not use MV3 optional_host_permissions`);
}

function checkBackgroundRuntime(target, manifest) {
  const backgroundFiles = target.manifestVersion === 3
    ? [manifest.background?.service_worker]
    : manifest.background?.scripts || [];

  assert(backgroundFiles.includes('background.js'), `${target.name} background.js must be declared`);

  const backgroundPath = join(target.outputDir, 'background.js');
  assertFileExists(backgroundPath, `${target.name} background.js is missing`);
  const background = readText(backgroundPath);

  for (const marker of [
    'runtime.onMessage.addListener',
    'bookmarks.onCreated.addListener',
    'bookmarks.onChanged.addListener',
    'bookmarks.onMoved.addListener',
    'bookmarks.onRemoved.addListener',
    'alarms.onAlarm.addListener',
    'storage.onChanged.addListener',
    'openOptionsPage',
  ]) {
    assert(background.includes(marker), `${target.name} background runtime is missing ${marker}`);
  }

  for (const commandName of [
    'upload',
    'download',
    'syncNow',
    'removeAll',
    'restoreSnapshot',
    'setting',
    'testStorage',
    'getSafetyStatus',
    'clearSafetyStatus',
    'getAutoSyncConflictStatus',
    'clearAutoSyncConflictStatus',
  ]) {
    assert(background.includes(`"${commandName}"`), `${target.name} background is missing message command ${commandName}`);
  }

  assert(background.includes('success:!0') || background.includes('success:true'), `${target.name} background must include success responses`);
  assert(background.includes('success:!1') || background.includes('success:false'), `${target.name} background must include failure responses`);
  assert(background.includes('action||') || background.includes('browserAction'), `${target.name} background must include MV2/MV3 badge fallback`);
}

function checkHtmlEntrypoint(target, page, label) {
  assert(Boolean(page), `${target.name} ${label} page is not declared`);
  const htmlPath = join(target.outputDir, page || '');
  assertFileExists(htmlPath, `${target.name} ${label} page is missing: ${page}`);
  const html = readText(htmlPath);

  assert(html.includes('<div id="root"></div>'), `${target.name} ${label} page must include the React root`);
  assert(!/https?:\/\//i.test(html), `${target.name} ${label} page must not load remote resources`);

  const scripts = extractAttributes(html, 'script', 'src');
  assert(scripts.length > 0, `${target.name} ${label} page must include a script entrypoint`);
  for (const script of scripts) {
    assert(script.startsWith('/chunks/'), `${target.name} ${label} script must be an extension chunk: ${script}`);
    assertFileExists(resolveOutputReference(target.outputDir, script), `${target.name} ${label} script chunk is missing: ${script}`);
  }

  for (const href of extractAttributes(html, 'link', 'href')) {
    assert(!/^https?:\/\//i.test(href), `${target.name} ${label} link must not be remote: ${href}`);
    assertFileExists(resolveOutputReference(target.outputDir, href), `${target.name} ${label} linked asset is missing: ${href}`);
  }
}

function checkLocaleRuntime(target, manifest) {
  const locale = manifest.default_locale || 'en';
  const messagesPath = join(target.outputDir, '_locales', locale, 'messages.json');
  assertFileExists(messagesPath, `${target.name} default locale messages are missing`);
  const messages = readJson(messagesPath);

  assert(messages.extensionName?.message === 'LibreBookmarkSync', `${target.name} default locale extensionName must be LibreBookmarkSync`);
  assert(Boolean(messages.extensionDescription?.message), `${target.name} default locale extensionDescription is missing`);
}

function extractAttributes(html, tagName, attributeName) {
  const values = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\s${attributeName}=["']([^"']+)["'][^>]*>`, 'gi');
  let match;
  while ((match = pattern.exec(html)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function resolveOutputReference(outputDir, reference) {
  const normalized = reference.startsWith('/') ? reference.slice(1) : reference;
  return join(outputDir, normalized);
}

function assertFileExists(path, message) {
  assert(existsSync(path), message);
  if (existsSync(path)) {
    assert(statSync(path).size > 0, `${relative(root, path)} must not be empty`);
  }
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    fail(`invalid JSON at ${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    fail(`could not read ${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
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
