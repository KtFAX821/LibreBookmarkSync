// SPDX-License-Identifier: Apache-2.0

import { defaultAppSettings } from '../src/settings/appSettings';
import { createStorageAdapter } from '../src/storage/storageFactory';
import { GistAdapter } from '../src/storage/gistAdapter';
import { WebDavAdapter } from '../src/storage/webdavAdapter';

runTests();

function runTests() {
  testDefaultStorageTypeIsWebDav();
  testCreatesWebDavAdapter();
  testCreatesGistAdapter();
  testRejectsUnsupportedStorageType();
  console.log('storageFactory tests passed');
}

function testDefaultStorageTypeIsWebDav() {
  assertEqual(defaultAppSettings.storageType, 'webdav', 'new installs should default to WebDAV storage');
}

function testCreatesWebDavAdapter() {
  const adapter = createStorageAdapter(setting({ storageType: 'webdav' }));

  assert(adapter instanceof WebDavAdapter, 'webdav settings should create a WebDAV adapter');
  assertEqual(adapter.type, 'webdav', 'webdav adapter should report the webdav type');
}

function testCreatesGistAdapter() {
  const adapter = createStorageAdapter(setting({ storageType: 'gist' }));

  assert(adapter instanceof GistAdapter, 'gist settings should create a Gist adapter');
  assertEqual(adapter.type, 'gist', 'gist adapter should report the gist type');
}

function testRejectsUnsupportedStorageType() {
  assertThrows(
    () => createStorageAdapter(setting({ storageType: 'damaged' })),
    'direct unsupported storage settings should fail before network work',
  );
}

function setting(overrides: Record<string, unknown>) {
  return {
    storageType: 'webdav',
    ...overrides,
  } as never;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(handler: () => unknown, message: string) {
  try {
    handler();
  } catch {
    return;
  }

  throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
