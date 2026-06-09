// SPDX-License-Identifier: Apache-2.0

import { testStorageConnection } from '../src/storage/testStorageConnection';
import type { StorageAdapter } from '../src/storage/storageAdapter';

runTests();

async function runTests() {
  await testReturnsBackendSpecificSuccessMessage();
  await testPropagatesAdapterFailures();
  console.log('testStorageConnection tests passed');
}

async function testReturnsBackendSpecificSuccessMessage() {
  const calls: string[] = [];
  const message = await testStorageConnection(
    { storageType: 'webdav' },
    setting => adapter(setting.storageType, async () => {
      calls.push('test');
    }),
  );

  assertEqual(message, 'webdav connection test successful', 'connection test should report the selected backend');
  assertEqual(calls.length, 1, 'connection test should call adapter.test once');
}

async function testPropagatesAdapterFailures() {
  await assertRejects(
    () => testStorageConnection(
      { storageType: 'gist' },
      setting => adapter(setting.storageType, async () => {
        throw new Error('missing optional host permission');
      }),
    ),
    'connection test should propagate adapter failures to the background response path',
  );
}

function adapter(type: string, test: () => Promise<void>): StorageAdapter {
  return {
    type,
    test,
    download: async () => null,
    upload: async () => undefined,
  };
}

async function assertRejects(handler: () => Promise<unknown>, message: string) {
  try {
    await handler();
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
