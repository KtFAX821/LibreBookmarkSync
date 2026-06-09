// SPDX-License-Identifier: Apache-2.0

const { existsSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const {
  forbiddenPublishPaths,
  requiredPublishPaths,
} = require('./github-publishing-rules.cjs');

const root = process.cwd();
const failures = [];

main();

function main() {
  const guide = readText('docs/GITHUB_PUBLISHING.md');
  const gitignore = readText('.gitignore');
  const wxtConfig = readText('wxt.config.ts');

  for (const path of requiredPublishPaths) {
    assert(guide.includes(`\`${path}\``), `docs/GITHUB_PUBLISHING.md must list required publish item ${path}`);
  }

  for (const path of forbiddenPublishPaths) {
    assert(guide.includes(`\`${path}\``), `docs/GITHUB_PUBLISHING.md must list forbidden publish item ${path}`);
  }

  for (const path of [
    'node_modules',
    '.pnpm-store',
    '.output',
    '.wxt',
    '.tmp',
    'fohimdklhhcpcnpmmichieidclgfdmol/',
    'assets/',
    'images/',
    'docs/HANDOFF.md',
    'docs/superpowers/',
  ]) {
    assert(hasGitignoreEntry(gitignore, path), `.gitignore must exclude ${path}`);
  }

  for (const path of [
    'fohimdklhhcpcnpmmichieidclgfdmol',
    'assets',
    'images',
    'docs/HANDOFF.md',
    'docs/superpowers',
    '.output',
    '.tmp',
  ]) {
    assert(wxtConfig.includes(`'${path}'`), `wxt.config.ts source zip exclusions must include ${path}`);
  }

  assert(guide.includes('Do not commit generated extension zip files'), 'GitHub guide must forbid committing release zips');
  assert(
    guide.includes('Accountless open-source browser bookmark sync with WebDAV, optional Gist, local history, snapshots, and encryption.'),
    'GitHub guide must include the recommended repository description',
  );
  assert(guide.includes('browser-extension bookmarks sync webdav gist local-first apache-2-0'), 'GitHub guide must include suggested repository topics');
  assert(guide.includes('GitHub Release'), 'GitHub guide must direct generated zips to GitHub Releases');
  assert(guide.includes('Do not attach `.output/libre-bookmark-sync-*-sources.zip`'), 'GitHub guide must keep sources zip out of compiled-extension Release attachments');
  assert(guide.includes('npm.cmd run check:github'), 'GitHub guide must require the GitHub publishing check');
  assert(guide.includes('npm.cmd run github:files'), 'GitHub guide must mention the GitHub publish file-list command');
  assert(guide.includes('npm.cmd run github:prepare'), 'GitHub guide must mention the GitHub publish folder preparation command');
  assert(guide.includes('WebDAV credentials'), 'GitHub guide must warn against publishing WebDAV credentials');
  assert(guide.includes('GitHub tokens'), 'GitHub guide must warn against publishing GitHub tokens');

  checkPublishFileList();

  if (failures.length > 0) {
    console.error('GitHub publishing checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('GitHub publishing checks passed');
}

function hasGitignoreEntry(gitignore, path) {
  return gitignore
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .includes(path);
}

function readText(path) {
  const resolved = join(root, path);
  if (!existsSync(resolved)) {
    fail(`missing file: ${path}`);
    return '';
  }

  return readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
}

function checkPublishFileList() {
  try {
    const fileList = execFileSync(process.execPath, ['scripts/list-github-publish-files.cjs'], {
      cwd: root,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);

    for (const requiredPath of requiredPublishPaths) {
      if (requiredPath.endsWith('/')) {
        assert(fileList.some(file => file.startsWith(requiredPath)), `publish file list must include files under ${requiredPath}`);
      } else {
        assert(fileList.includes(requiredPath), `publish file list must include ${requiredPath}`);
      }
    }

    for (const forbiddenPath of forbiddenPublishPaths) {
      if (forbiddenPath.includes('*')) {
        continue;
      }
      const normalizedForbidden = forbiddenPath.replace(/\/$/, '');
      assert(
        !fileList.some(file => file === normalizedForbidden || file.startsWith(forbiddenPath)),
        `publish file list must not include ${forbiddenPath}`,
      );
    }
  } catch (error) {
    fail(`could not generate GitHub publish file list: ${error instanceof Error ? error.message : String(error)}`);
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
