// SPDX-License-Identifier: Apache-2.0

import { compressToUTF16 } from 'lz-string';
import { getBaseBookmarksFromSyncState } from '../src/sync/syncState';

runTests();

function runTests() {
  returnsNullWhenStateIsMissing();
  returnsNullWhenCompressedBaselineIsMissing();
  returnsNullWhenCompressedBaselineIsCorrupt();
  returnsNullWhenDecompressedBaselineIsMalformedJson();
  returnsNullWhenDecompressedBaselineIsNotAnArray();
  returnsBookmarksWhenBaselineIsValid();
  console.log('syncState tests passed');
}

function returnsNullWhenStateIsMissing() {
  assertEqual(getBaseBookmarksFromSyncState(null), null, 'missing sync state should not provide a baseline');
}

function returnsNullWhenCompressedBaselineIsMissing() {
  assertEqual(
    getBaseBookmarksFromSyncState({
      localHash: 'local',
      remoteHash: 'remote',
      updatedAt: 1,
    }),
    null,
    'sync state without compressed bookmarks should not provide a baseline',
  );
}

function returnsNullWhenCompressedBaselineIsCorrupt() {
  assertEqual(
    getBaseBookmarksFromSyncState({
      localHash: 'local',
      remoteHash: 'remote',
      updatedAt: 1,
      baseBookmarksCompressed: 'not compressed data',
    }),
    null,
    'corrupt compressed baseline should fall back to no baseline',
  );
}

function returnsNullWhenDecompressedBaselineIsMalformedJson() {
  assertEqual(
    getBaseBookmarksFromSyncState({
      localHash: 'local',
      remoteHash: 'remote',
      updatedAt: 1,
      baseBookmarksCompressed: compressToUTF16('{not-json'),
    }),
    null,
    'malformed baseline JSON should fall back to no baseline',
  );
}

function returnsNullWhenDecompressedBaselineIsNotAnArray() {
  assertEqual(
    getBaseBookmarksFromSyncState({
      localHash: 'local',
      remoteHash: 'remote',
      updatedAt: 1,
      baseBookmarksCompressed: compressToUTF16(JSON.stringify({ title: 'Not an array' })),
    }),
    null,
    'non-array baseline JSON should fall back to no baseline',
  );
}

function returnsBookmarksWhenBaselineIsValid() {
  const bookmarks = [
    {
      title: 'Baseline',
      url: 'https://example.com/baseline',
    },
  ];

  const result = getBaseBookmarksFromSyncState({
    localHash: 'local',
    remoteHash: 'remote',
    updatedAt: 1,
    baseBookmarksCompressed: compressToUTF16(JSON.stringify(bookmarks)),
  });

  assertEqual(result?.[0]?.title, 'Baseline', 'valid compressed baseline should be parsed');
  assertEqual(result?.[0]?.url, 'https://example.com/baseline', 'valid compressed baseline URL should be parsed');
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
