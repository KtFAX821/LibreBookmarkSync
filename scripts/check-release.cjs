// SPDX-License-Identifier: Apache-2.0

const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = process.cwd();
const closedReleaseDirName = 'fohimdklhhcpcnpmmichieidclgfdmol';
const buildTargets = [
  {
    name: 'Chrome MV3',
    outputDir: join(root, '.output', 'chrome-mv3'),
    manifestVersion: 3,
    optionalPermissionsLocation: 'optional_host_permissions',
  },
  {
    name: 'Firefox MV2',
    outputDir: join(root, '.output', 'firefox-mv2'),
    manifestVersion: 2,
    optionalPermissionsLocation: 'optional_permissions',
  },
];
const failures = [];

checkPackageMetadata();
checkGitIgnore();
checkLocales();
checkBrowserActionCompatibilityLayer();
checkRuntimeMessageHelper();
checkBackgroundMessageResponses();
checkManualCommandFailurePropagation();
for (const target of buildTargets) {
  checkManifest(target);
  checkOutputFiles(target);
  checkIconDimensions(target);
  checkClosedReleaseNotPackaged(target);
}
checkIconSource();
checkForbiddenRuntimeStrings();

if (failures.length > 0) {
  console.error('Release checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('release checks passed');
}

function checkPackageMetadata() {
  const packageJson = readJson(join(root, 'package.json'));
  assert(packageJson.name === 'libre-bookmark-sync', 'package name must be libre-bookmark-sync');
  assert(packageJson.license === 'Apache-2.0', 'package license must be Apache-2.0');
  assert(!String(packageJson.version || '').includes('1.0.3'), 'package version must not claim the closed 1.0.3 release');
}

function checkGitIgnore() {
  const gitIgnore = readText(join(root, '.gitignore'));
  assert(gitIgnore.includes(`${closedReleaseDirName}/`), `closed release directory must stay ignored: ${closedReleaseDirName}/`);
  assert(gitIgnore.includes('.output'), '.output must stay ignored');
  assert(gitIgnore.includes('.tmp'), '.tmp must stay ignored');
}

function checkLocales() {
  const localesDir = join(root, 'src', 'public', '_locales');
  const locales = readdirSync(localesDir)
    .filter(name => statSync(join(localesDir, name)).isDirectory());

  assert(locales.includes('en'), 'English locale must exist');
  for (const locale of locales) {
    const messagesPath = join(localesDir, locale, 'messages.json');
    const messages = readJson(messagesPath);
    assert(Boolean(messages.extensionName?.message), `${locale} locale must define extensionName`);
    assert(Boolean(messages.extensionDescription?.message), `${locale} locale must define extensionDescription`);
    assert(
      String(messages.extensionName?.message || '').includes('LibreBookmarkSync'),
      `${locale} extensionName must use LibreBookmarkSync identity`,
    );
  }
}

function checkBrowserActionCompatibilityLayer() {
  const compatibilityLayerPath = join(root, 'src', 'utils', 'extensionAction.ts');
  assert(existsSync(compatibilityLayerPath), 'MV2/MV3 action compatibility layer must exist at src/utils/extensionAction.ts');

  const directActionApiPattern = /\bbrowser\.(action|browserAction)\b/;
  const sourceFiles = listTextFiles(join(root, 'src'))
    .filter(file => file !== compatibilityLayerPath);

  for (const file of sourceFiles) {
    if (directActionApiPattern.test(readText(file))) {
      fail(`direct browser action API usage must go through src/utils/extensionAction.ts: ${relative(root, file)}`);
    }
  }
}

function checkRuntimeMessageHelper() {
  const runtimeMessageHelperPath = join(root, 'src', 'utils', 'runtimeMessages.ts');
  assert(existsSync(runtimeMessageHelperPath), 'runtime message helper must exist at src/utils/runtimeMessages.ts');

  const directRuntimeSendPattern = /\bbrowser\.runtime\.sendMessage\b/;
  const sourceFiles = listTextFiles(join(root, 'src'))
    .filter(file => file !== runtimeMessageHelperPath);

  for (const file of sourceFiles) {
    if (directRuntimeSendPattern.test(readText(file))) {
      fail(`runtime sendMessage usage must go through src/utils/runtimeMessages.ts: ${relative(root, file)}`);
    }
  }
}

function checkBackgroundMessageResponses() {
  const backgroundPath = join(root, 'src', 'entrypoints', 'background.ts');
  const background = readText(backgroundPath);

  assert(!/\bsendResponse\(\s*(true|false)\s*\)/.test(background), 'background command responses must use structured success objects instead of bare booleans');
  assert(background.includes('function sendOperationResponse'), 'background must keep sendOperationResponse helper for user-triggered commands');
  assert(background.includes('success: false'), 'background operation responses must include a failure shape');
  assert(background.includes('message: error instanceof Error ? error.message : String(error)'), 'background operation failures must include an error message');

  for (const commandName of ['upload', 'download', 'syncNow', 'removeAll', 'restoreSnapshot', 'setting']) {
    const commandPattern = new RegExp(`case '${commandName}':[\\s\\S]*?sendOperationResponse\\([\\s\\S]*?return true;`);
    assert(commandPattern.test(background), `background ${commandName} message must use sendOperationResponse`);
  }
}

function checkManualCommandFailurePropagation() {
  const manualSyncPath = join(root, 'src', 'sync', 'manualGistSync.ts');
  const manualSync = readText(manualSyncPath);
  const requiredFailureThrows = [
    'export async function uploadBookmarksToStorage',
    'export async function downloadBookmarksFromStorage',
    'export async function removeAllLocalBookmarks',
    'export async function restoreLocalBookmarksFromSnapshot',
  ];

  for (const marker of requiredFailureThrows) {
    const start = manualSync.indexOf(marker);
    assert(start !== -1, `manual sync module must keep ${marker}`);
    const nextExport = manualSync.indexOf('\nexport ', start + marker.length);
    const body = manualSync.slice(start, nextExport === -1 ? manualSync.length : nextExport);
    assert(
      /\bcatch\s*\(\s*error\s*\)[\s\S]*\bnotifyError\b[\s\S]*\bthrow\s+error\s*;/m.test(body),
      `${marker} must notify and rethrow failures so popup/options receive success: false`,
    );
  }
}

function checkManifest(target) {
  const manifest = readJson(join(target.outputDir, 'manifest.json'));
  assert(manifest.manifest_version === target.manifestVersion, `${target.name} manifest version must be ${target.manifestVersion}`);
  assert(manifest.name === '__MSG_extensionName__', `${target.name} manifest name must use locale message`);
  assert(manifest.description === '__MSG_extensionDescription__', `${target.name} manifest description must use locale message`);
  assert(manifest.default_locale === 'en', `${target.name} manifest default locale must be en`);
  assert(manifest.options_ui?.page === 'options.html', `${target.name} manifest must expose options.html`);

  if (target.manifestVersion === 3) {
    assert(manifest.background?.service_worker === 'background.js', `${target.name} manifest must have a background service worker`);
    assert(manifest.action?.default_popup === 'popup.html', `${target.name} manifest must expose popup.html through action`);
  } else {
    assert(
      Array.isArray(manifest.background?.scripts) && manifest.background.scripts.includes('background.js'),
      `${target.name} manifest must have background.js in background.scripts`,
    );
    assert(manifest.browser_action?.default_popup === 'popup.html', `${target.name} manifest must expose popup.html through browser_action`);
  }

  const permissions = manifest.permissions || [];
  for (const permission of ['storage', 'bookmarks', 'notifications', 'alarms']) {
    assert(permissions.includes(permission), `${target.name} manifest must include ${permission} permission`);
  }

  const allowedPermissions = [
    'storage',
    'bookmarks',
    'notifications',
    'alarms',
  ];

  const unexpectedPermissions = permissions.filter(permission => !allowedPermissions.includes(permission));
  assert(unexpectedPermissions.length === 0, `${target.name} unexpected manifest permissions: ${unexpectedPermissions.join(', ')}`);

  const requiredOptionalHostPermissions = [
    'https://api.github.com/*',
    'https://gist.githubusercontent.com/*',
    '*://*/*',
  ];
  const optionalPermissions = manifest[target.optionalPermissionsLocation] || [];
  for (const permission of requiredOptionalHostPermissions) {
    assert(
      optionalPermissions.includes(permission),
      `${target.name} manifest must keep optional storage host permission ${permission} in ${target.optionalPermissionsLocation}`,
    );
  }

  const forbiddenDefaultHostPermissions = [
    'https://api.github.com/*',
    'https://gist.githubusercontent.com/*',
    'https://*.github.com/',
    'https://*.githubusercontent.com/',
    '*://*/*',
  ];
  const defaultHostPermissions = [
    ...permissions,
    ...(manifest.host_permissions || []),
  ];
  for (const permission of forbiddenDefaultHostPermissions) {
    assert(
      !defaultHostPermissions.includes(permission),
      `${target.name} must not request storage host permission by default: ${permission}`,
    );
  }

  assert(
    Array.isArray(optionalPermissions),
    `${target.name} manifest must expose optional storage host permissions through ${target.optionalPermissionsLocation}`,
  );
}

function checkOutputFiles(target) {
  for (const file of [
    'manifest.json',
    'background.js',
    'popup.html',
    'options.html',
    'icons/16.png',
    'icons/32.png',
    'icons/48.png',
    'icons/128.png',
  ]) {
    assert(existsSync(join(target.outputDir, file)), `${target.name} built extension output is missing ${file}`);
  }
}

function checkIconDimensions(target) {
  for (const size of [16, 32, 48, 128]) {
    const iconPath = join(target.outputDir, 'icons', `${size}.png`);
    const dimensions = readPngDimensions(iconPath);
    assert(dimensions.width === size, `${target.name} icons/${size}.png width must be ${size}px, got ${dimensions.width}px`);
    assert(dimensions.height === size, `${target.name} icons/${size}.png height must be ${size}px, got ${dimensions.height}px`);
  }
}

function checkIconSource() {
  const iconPath = join(root, 'src', 'assets', 'icon.svg');
  const icon = readText(iconPath);

  assert(existsSync(iconPath), 'extension icon source must exist at src/assets/icon.svg');
  assert(/<svg\b/i.test(icon), 'extension icon source must be SVG');
  assert(!/<!DOCTYPE/i.test(icon), 'extension icon source must not declare an external SVG DTD');
  assert(/\bviewBox=["']0 0 512 512["']/i.test(icon), 'extension icon source must use a square 512x512 viewBox');
}

function checkForbiddenRuntimeStrings() {
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

  const files = [
    ...listTextFiles(join(root, 'src')),
    ...buildTargets.flatMap(target => listTextFiles(target.outputDir)),
  ];

  for (const file of files) {
    const content = readText(file);
    for (const { pattern, label } of forbiddenPatterns) {
      if (pattern.test(content)) {
        fail(`forbidden runtime string found (${label}) in ${relative(root, file)}`);
      }
    }
  }
}

function checkClosedReleaseNotPackaged(target) {
  const outputFiles = listTextFiles(target.outputDir);
  for (const file of outputFiles) {
    const rel = relative(target.outputDir, file);
    assert(!rel.includes(closedReleaseDirName), `${target.name} closed release file must not be packaged: ${rel}`);
  }
}

function listTextFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listTextFiles(path));
      continue;
    }

    if (/\.(c?js|mjs|json|html|css|tsx?|md|txt|svg)$/i.test(name)) {
      files.push(path);
    }
  }
  return files;
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

function readPngDimensions(path) {
  try {
    const png = readFileSync(path);
    const expectedSignature = '89504e470d0a1a0a';
    assert(png.subarray(0, 8).toString('hex') === expectedSignature, `${relative(root, path)} must be a PNG file`);
    assert(png.subarray(12, 16).toString('ascii') === 'IHDR', `${relative(root, path)} must have a PNG IHDR chunk`);
    return {
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
    };
  } catch (error) {
    fail(`could not read PNG dimensions for ${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
    return { width: 0, height: 0 };
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
