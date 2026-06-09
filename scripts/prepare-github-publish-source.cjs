// SPDX-License-Identifier: Apache-2.0

const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync, rmSync, statSync } = require('node:fs');
const { dirname, join, resolve, relative } = require('node:path');

const root = process.cwd();
const destination = resolve(root, getDestination());

assertSafeDestination(destination);
resetDestination(destination);
mkdirSync(destination, { recursive: true });

const files = getPublishFiles();
for (const file of files) {
  const source = join(root, file);
  const target = join(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

runInDestination('scripts/check-docs.cjs');
runInDestination('scripts/check-github-publishing.cjs');

console.log(`prepared GitHub publish source folder: ${destination}`);
console.log(`copied ${files.length} files`);

function getDestination() {
  const explicitArg = process.argv.find(arg => arg.startsWith('--dest='));
  if (explicitArg) {
    return explicitArg.slice('--dest='.length);
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  return join('.tmp', `github-publish-source-${stamp}`);
}

function getPublishFiles() {
  const output = execFileSync(process.execPath, ['scripts/list-github-publish-files.cjs'], {
    cwd: root,
    encoding: 'utf8',
  });

  return output.trim().split(/\r?\n/).filter(Boolean);
}

function runInDestination(scriptPath) {
  execFileSync(process.execPath, [scriptPath], {
    cwd: destination,
    stdio: 'inherit',
  });
}

function assertSafeDestination(targetPath) {
  if (targetPath === root) {
    throw new Error('Refusing to prepare publish source into the project root');
  }

  const relativeTarget = relative(root, targetPath).replace(/\\/g, '/');
  if (relativeTarget.startsWith('..') || relativeTarget === '') {
    throw new Error('Destination must stay inside this workspace');
  }

  const allowedPrefix = '.tmp/';
  if (!relativeTarget.startsWith(allowedPrefix)) {
    throw new Error('Destination must be under .tmp/');
  }

  if (existsSync(targetPath) && !statSync(targetPath).isDirectory()) {
    throw new Error('Destination exists and is not a directory');
  }
}

function resetDestination(targetPath) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}
