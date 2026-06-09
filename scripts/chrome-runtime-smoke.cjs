// SPDX-License-Identifier: Apache-2.0

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { spawn } = require('node:child_process');

const root = process.cwd();
const args = process.argv.slice(2);
const dryRun = hasFlag('dry-run');
const keepOpen = hasFlag('keep-open');
const timeoutMs = Number(readOption('timeout-ms') || 30000);
const browserName = readOption('browser') || 'chrome';
const browserConfigs = {
  chrome: {
    label: 'Chrome',
    envName: 'CHROME_BIN',
    executableCandidates: [
      process.env.CHROME_BIN,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
  },
  edge: {
    label: 'Edge',
    envName: 'EDGE_BIN',
    executableCandidates: [
      process.env.EDGE_BIN,
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  },
};
const browserConfig = browserConfigs[browserName];
const reportPath = resolve(root, readOption('report') || join('.tmp', 'runtime-smoke', `${browserName}-runtime-smoke-${Date.now()}.json`));

const extensionOutput = resolve(root, '.output', 'chrome-mv3');
const profileDir = resolve(root, '.tmp', 'runtime-smoke', `${browserName}-${Date.now()}`);
const browserPath = browserConfig?.executableCandidates.filter(Boolean).find(candidate => existsSync(candidate));

if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

if (!browserConfig) {
  console.error(`Unsupported browser: ${browserName}. Use --browser=chrome or --browser=edge.`);
  process.exit(1);
}

if (!browserPath) {
  console.error(`${browserConfig.label} was not found. Set ${browserConfig.envName} to a ${browserConfig.label} executable path.`);
  process.exit(1);
}

if (!existsSync(extensionOutput)) {
  console.error('Chrome MV3 output is missing. Run npm.cmd run verify:release first.');
  process.exit(1);
}

const launchArgs = [
  `--user-data-dir=${profileDir}`,
  `--load-extension=${extensionOutput}`,
  `--disable-extensions-except=${extensionOutput}`,
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
  'about:blank',
];

if (dryRun) {
  printLaunchPlan();
  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  mkdirSync(profileDir, { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  printLaunchPlan();

  const report = {
    browser: browserName,
    browserPath,
    profileDir,
    extensionDir: extensionOutput,
    startedAt: new Date().toISOString(),
    devtoolsPort: null,
    devtoolsRequests: [],
    extensionId: '',
    pages: [],
    errors: [],
    browserProcess: {
      pid: 0,
      exitCode: null,
      signal: null,
    },
    passed: false,
  };

  const browserProcess = spawn(browserPath, launchArgs, {
    stdio: 'ignore',
    windowsHide: false,
  });
  report.browserProcess.pid = browserProcess.pid || 0;
  browserProcess.once('exit', (exitCode, signal) => {
    report.browserProcess.exitCode = exitCode;
    report.browserProcess.signal = signal;
  });

  try {
    const port = await waitForDevToolsPort();
    report.devtoolsPort = port;
    const browserSocketUrl = await getBrowserSocketUrl(port, report);
    const browser = await CdpConnection.connect(browserSocketUrl);

    try {
      const extensionId = await waitForExtensionId(port, report);
      report.extensionId = extensionId;

      await inspectTarget(browser, `chrome-extension://${extensionId}/options.html`, 'options', report);
      await inspectTarget(browser, `chrome-extension://${extensionId}/popup.html`, 'popup', report);

      if (report.errors.length > 0) {
        fail(`${browserConfig.label} runtime smoke found errors:\n- ${report.errors.join('\n- ')}`);
      }

      report.passed = true;
      writeReport(report);
      console.log(`${browserName} runtime smoke passed`);
      console.log(`Extension ID: ${extensionId}`);
      console.log(`Profile: ${profileDir}`);
      console.log(`Report: ${reportPath}`);
    } finally {
      browser.close();
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    writeReport(report);
    throw error;
  } finally {
    if (!keepOpen) {
      browserProcess.kill();
    }
  }
}

async function inspectTarget(browser, url, label, report) {
  const page = {
    label,
    url,
    readyState: '',
    hasRoot: false,
    renderedLibreBookmarkSync: false,
    manifestName: '',
    manifestVersion: '',
  };
  report.pages.push(page);

  const { targetId } = await browser.send('Target.createTarget', { url });
  const { sessionId } = await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  browser.onSessionEvent(sessionId, event => {
    if (event.method === 'Runtime.exceptionThrown') {
      report.errors.push(`${label}: ${event.params.exceptionDetails?.text || 'runtime exception'}`);
    }
    if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
      report.errors.push(`${label}: ${event.params.args?.map(formatRemoteValue).join(' ') || 'console error'}`);
    }
  });

  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('Page.enable', {}, sessionId);
  await waitForDocumentReady(browser, sessionId, label);

  const result = await browser.send('Runtime.evaluate', {
    expression: `(() => ({
      readyState: document.readyState,
      hasRoot: Boolean(document.getElementById('root')),
      bodyText: document.body ? document.body.innerText : '',
      manifestName: chrome.runtime.getManifest().name,
      manifestVersion: chrome.runtime.getManifest().version
    }))()`,
    returnByValue: true,
  }, sessionId);

  const value = result.result?.value || {};
  page.readyState = value.readyState || '';
  page.hasRoot = Boolean(value.hasRoot);
  page.renderedLibreBookmarkSync = String(value.bodyText || '').includes('LibreBookmarkSync');
  page.manifestName = value.manifestName || '';
  page.manifestVersion = value.manifestVersion || '';

  if (!value.hasRoot) {
    report.errors.push(`${label}: missing React root`);
  }
  if (!String(value.bodyText || '').includes('LibreBookmarkSync')) {
    report.errors.push(`${label}: LibreBookmarkSync text was not rendered`);
  }
  if (!['__MSG_extensionName__', 'LibreBookmarkSync'].includes(value.manifestName)) {
    report.errors.push(`${label}: unexpected manifest name ${value.manifestName}`);
  }
}

async function waitForDocumentReady(browser, sessionId, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await browser.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    }, sessionId);
    if (result.result?.value === 'complete') {
      await delay(500);
      return;
    }
    await delay(250);
  }

  fail(`${label} page did not finish loading`);
}

async function waitForExtensionId(port, report) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const targets = await getJson(port, '/json/list', report);
    const extensionTarget = targets.find(target => (
      target.type === 'service_worker' &&
      /^chrome-extension:\/\//.test(target.url)
    ));

    if (extensionTarget) {
      const match = extensionTarget.url.match(/^chrome-extension:\/\/([^/]+)/);
      if (match) {
        return match[1];
      }
    }

    await delay(250);
  }

  fail(`Could not find the LibreBookmarkSync extension service worker target in ${browserConfig.label}.`);
}

async function waitForDevToolsPort() {
  const activePortPath = join(profileDir, 'DevToolsActivePort');
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(activePortPath)) {
      const [port] = readFileSync(activePortPath, 'utf8').split(/\r?\n/);
      if (port) {
        return Number(port);
      }
    }
    await delay(100);
  }

  fail(`${browserConfig.label} did not expose a DevTools port.`);
}

async function getBrowserSocketUrl(port, report) {
  const version = await getJson(port, '/json/version', report);
  if (!version.webSocketDebuggerUrl) {
    fail(`${browserConfig.label} DevTools version response did not include a browser websocket URL.`);
  }
  return version.webSocketDebuggerUrl;
}

async function getJson(port, path, report) {
  const url = `http://127.0.0.1:${port}${path}`;
  const request = {
    url,
    status: null,
    ok: false,
    error: '',
  };
  report?.devtoolsRequests?.push(request);

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    request.error = error instanceof Error ? error.message : String(error);
    fail(`${browserConfig.label} DevTools request failed for ${url}: ${request.error}`);
  }

  request.status = response.status;
  request.ok = response.ok;
  if (!response.ok) {
    fail(`${browserConfig.label} DevTools request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionListeners = new Map();

    socket.addEventListener('message', event => this.handleMessage(event));
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('Chrome DevTools websocket closed'));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolvePromise, rejectPromise) => {
      socket.addEventListener('open', resolvePromise, { once: true });
      socket.addEventListener('error', rejectPromise, { once: true });
    });
    return new CdpConnection(socket);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) {
      message.sessionId = sessionId;
    }

    const promise = new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, {
        resolve: resolvePromise,
        reject: rejectPromise,
      });
    });

    this.socket.send(JSON.stringify(message));
    return promise;
  }

  onSessionEvent(sessionId, listener) {
    const listeners = this.sessionListeners.get(sessionId) || [];
    listeners.push(listener);
    this.sessionListeners.set(sessionId, listeners);
  }

  close() {
    this.socket.close();
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }
      pending.resolve(message.result || {});
      return;
    }

    if (message.sessionId) {
      for (const listener of this.sessionListeners.get(message.sessionId) || []) {
        listener(message);
      }
    }
  }
}

function printLaunchPlan() {
  console.log(`Browser: ${browserName}`);
  console.log(`Executable: ${browserPath}`);
  console.log(`Profile: ${profileDir}`);
  console.log(`Extension: ${extensionOutput}`);
  console.log(`Report: ${reportPath}`);
  console.log('');
  console.log('Command:');
  console.log([quote(browserPath), ...launchArgs.map(quote)].join(' '));
}

function writeReport(report) {
  report.finishedAt = new Date().toISOString();
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function formatRemoteValue(value) {
  if ('value' in value) {
    return String(value.value);
  }
  return value.description || value.type || '';
}

function readOption(name) {
  const prefix = `--${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function quote(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function delay(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}

function printHelp() {
  console.log('Usage:');
  console.log('  node scripts/chrome-runtime-smoke.cjs');
  console.log('  node scripts/chrome-runtime-smoke.cjs --browser=edge');
  console.log('  node scripts/chrome-runtime-smoke.cjs --dry-run');
  console.log('  node scripts/chrome-runtime-smoke.cjs --keep-open');
  console.log('  node scripts/chrome-runtime-smoke.cjs --report=.tmp/runtime-smoke/chrome-report.json');
  console.log('  node scripts/chrome-runtime-smoke.cjs --timeout-ms=45000');
  console.log('');
  console.log('This launches Chrome or Edge with .output/chrome-mv3 in an isolated profile and checks options/popup pages through the Chrome DevTools Protocol.');
}

function fail(message) {
  throw new Error(message);
}
