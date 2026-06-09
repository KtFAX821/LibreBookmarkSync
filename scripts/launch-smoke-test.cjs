// SPDX-License-Identifier: Apache-2.0

const { existsSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawn } = require('node:child_process');

const root = process.cwd();
const args = process.argv.slice(2);
const browserArg = readOption('browser');
const dryRun = hasFlag('dry-run');
const listOnly = hasFlag('list') || !browserArg;

const chromeOutput = resolve(root, '.output', 'chrome-mv3');
const firefoxOutput = resolve(root, '.output', 'firefox-mv2');
const tmpProfileRoot = resolve(root, '.tmp', 'smoke-profiles');

const browserCandidates = {
  chrome: [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  edge: [
    process.env.EDGE_BIN,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  firefox: [
    process.env.FIREFOX_BIN,
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ],
};

if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

if (listOnly) {
  printDetectedBrowsers();
  console.log('');
  printHelp();
  process.exit(0);
}

if (!['chrome', 'edge', 'firefox'].includes(browserArg)) {
  fail(`Unsupported browser: ${browserArg}`);
}

launch(browserArg);

function launch(browserName) {
  const executable = findBrowser(browserName);
  if (!executable) {
    fail(`Could not find ${browserName}. Set CHROME_BIN, EDGE_BIN, or FIREFOX_BIN to an executable path.`);
  }

  const profileDir = join(tmpProfileRoot, browserName);

  const launchArgs = browserName === 'firefox'
    ? firefoxArgs(profileDir)
    : chromiumArgs(profileDir);

  printLaunchPlan(browserName, executable, launchArgs);

  if (dryRun) {
    return;
  }

  mkdirSync(profileDir, { recursive: true });

  const child = spawn(executable, launchArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
}

function chromiumArgs(profileDir) {
  assertOutput(chromeOutput, 'Chrome MV3');
  return [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${chromeOutput}`,
    '--no-first-run',
    '--no-default-browser-check',
    'chrome://extensions',
  ];
}

function firefoxArgs(profileDir) {
  assertOutput(firefoxOutput, 'Firefox MV2');
  return [
    '--no-remote',
    '--profile',
    profileDir,
    'about:debugging#/runtime/this-firefox',
  ];
}

function printLaunchPlan(browserName, executable, launchArgs) {
  console.log(`Browser: ${browserName}`);
  console.log(`Executable: ${executable}`);
  console.log(`Profile: ${join(tmpProfileRoot, browserName)}`);

  if (browserName === 'firefox') {
    console.log(`Extension manifest to load manually: ${join(firefoxOutput, 'manifest.json')}`);
  } else {
    console.log(`Extension directory: ${chromeOutput}`);
  }

  console.log('');
  console.log('Command:');
  console.log([quote(executable), ...launchArgs.map(quote)].join(' '));
}

function printDetectedBrowsers() {
  console.log('Detected smoke-test browser executables:');
  for (const browserName of ['chrome', 'edge', 'firefox']) {
    const executable = findBrowser(browserName);
    console.log(`- ${browserName}: ${executable || 'not found'}`);
  }
}

function printHelp() {
  console.log('Usage:');
  console.log('  node scripts/launch-smoke-test.cjs --list');
  console.log('  node scripts/launch-smoke-test.cjs --browser=chrome');
  console.log('  node scripts/launch-smoke-test.cjs --browser=edge');
  console.log('  node scripts/launch-smoke-test.cjs --browser=firefox');
  console.log('  node scripts/launch-smoke-test.cjs --browser=chrome --dry-run');
  console.log('');
  console.log('Notes:');
  console.log('- Chrome and Edge launch with .output/chrome-mv3 loaded into an isolated .tmp profile.');
  console.log('- Firefox opens about:debugging with an isolated .tmp profile; load .output/firefox-mv2/manifest.json as a temporary add-on.');
  console.log('- This helper only starts the manual smoke-test environment. It does not validate bookmark APIs, permissions, remote storage, alarms, notifications, or sync behavior by itself.');
}

function findBrowser(browserName) {
  return browserCandidates[browserName]
    .filter(Boolean)
    .find(candidate => existsSync(candidate));
}

function assertOutput(outputDir, label) {
  if (!existsSync(outputDir)) {
    fail(`${label} output is missing at ${outputDir}. Run npm.cmd run verify:release first.`);
  }
}

function readOption(name) {
  const prefix = `--${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).toLowerCase() : '';
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function quote(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
