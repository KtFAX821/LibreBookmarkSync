// SPDX-License-Identifier: Apache-2.0

const { execFileSync } = require('node:child_process');

run(process.execPath, ['scripts/run-merge-tests.cjs']);
run(process.execPath, ['scripts/check-locales.cjs']);
run(process.execPath, ['scripts/check-docs.cjs']);
run(process.execPath, ['scripts/check-github-publishing.cjs']);
run(process.execPath, ['scripts/check-ui-style.cjs']);
run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
runWxtBuild('chrome');
runWxtBuild('firefox');
run(process.execPath, ['scripts/check-release.cjs']);
run(process.execPath, ['scripts/check-runtime-preflight.cjs']);
runWxtZip('chrome');
runWxtZip('firefox');
run(process.execPath, ['scripts/check-packages.cjs']);

console.log('release verification passed');

function run(command, args) {
  execFileSync(command, args, {
    stdio: 'inherit',
  });
}

function runWxtBuild(browser) {
  const args = browser === 'firefox'
    ? ['node_modules/wxt/bin/wxt.mjs', 'build', '-b', 'firefox']
    : ['node_modules/wxt/bin/wxt.mjs', 'build'];

  run(process.execPath, args);
}

function runWxtZip(browser) {
  const args = browser === 'firefox'
    ? ['node_modules/wxt/bin/wxt.mjs', 'zip', '-b', 'firefox']
    : ['node_modules/wxt/bin/wxt.mjs', 'zip'];

  run(process.execPath, args);
}
