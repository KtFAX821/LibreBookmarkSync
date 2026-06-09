// SPDX-License-Identifier: Apache-2.0

const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const {
  forbiddenPublishPaths,
  requiredPublishPaths,
} = require('./github-publishing-rules.cjs');

const root = process.cwd();
const failures = [];

const files = collectPublishFiles();
const sortedFiles = [...files].sort((left, right) => left.localeCompare(right));

for (const file of sortedFiles) {
  assert(!isForbidden(file), `publish file list must not include forbidden path: ${file}`);
}

if (failures.length > 0) {
  console.error('GitHub publish file list failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (process.argv.includes('--count')) {
  console.log(sortedFiles.length);
} else {
  console.log(sortedFiles.join('\n'));
}

function collectPublishFiles() {
  const seen = new Set();

  for (const publishPath of requiredPublishPaths) {
    const normalizedPath = normalizePath(publishPath);
    const absolutePath = join(root, normalizedPath);

    if (!existsSync(absolutePath)) {
      fail(`missing required publish path: ${publishPath}`);
      continue;
    }

    if (publishPath.endsWith('/')) {
      collectDirectory(normalizedPath, seen);
    } else {
      seen.add(normalizedPath);
    }
  }

  return seen;
}

function collectDirectory(relativePath, seen) {
  for (const entry of readdirSync(join(root, relativePath), { withFileTypes: true })) {
    const childPath = `${relativePath}/${entry.name}`;
    if (isForbidden(childPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectDirectory(childPath, seen);
      continue;
    }

    if (entry.isFile()) {
      seen.add(childPath);
    }
  }
}

function isForbidden(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  return forbiddenPublishPaths.some(forbiddenPath => {
    if (forbiddenPath.includes('*')) {
      return wildcardToRegExp(forbiddenPath).test(normalizedPath);
    }

    const normalizedForbidden = normalizePath(forbiddenPath);
    if (normalizedForbidden.endsWith('/')) {
      return normalizedPath === normalizedForbidden.slice(0, -1)
        || normalizedPath.startsWith(normalizedForbidden);
    }

    return normalizedPath === normalizedForbidden;
  });
}

function wildcardToRegExp(pattern) {
  const escaped = normalizePath(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  failures.push(message);
}
