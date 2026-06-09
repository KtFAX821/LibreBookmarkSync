// SPDX-License-Identifier: Apache-2.0

import { normalizeSyncHistoryRecords, type SyncHistoryRecord } from '../src/history/syncHistory';

runTests();

function runTests() {
  returnsEmptyHistoryForMissingOrCorruptStorage();
  keepsOnlyValidHistoryRecords();
  sortsNewestRecordsFirst();
  limitsHistoryToTheConfiguredMaximum();
  usesDefaultLimitForInvalidMaximums();
  console.log('syncHistory tests passed');
}

function returnsEmptyHistoryForMissingOrCorruptStorage() {
  assertEqual(normalizeSyncHistoryRecords(undefined).length, 0, 'missing history should become empty');
  assertEqual(normalizeSyncHistoryRecords({}).length, 0, 'object history should become empty');
  assertEqual(normalizeSyncHistoryRecords('bad').length, 0, 'string history should become empty');
}

function keepsOnlyValidHistoryRecords() {
  const records = normalizeSyncHistoryRecords([
    record({ id: 'valid' }),
    record({ id: '' }),
    record({ operation: 'unknown' as never }),
    record({ status: 'pending' as never }),
    record({ timestamp: Number.NaN }),
    record({ message: 12 as never }),
    record({ bookmarkCount: Number.NaN }),
    null,
  ]);

  assertEqual(records.length, 1, 'only one valid record should remain');
  assertEqual(records[0].id, 'valid', 'valid record should be preserved');
}

function sortsNewestRecordsFirst() {
  const records = normalizeSyncHistoryRecords([
    record({ id: 'old', timestamp: 100 }),
    record({ id: 'new', timestamp: 300 }),
    record({ id: 'middle', timestamp: 200 }),
  ]);

  assertEqual(records.map(item => item.id).join(','), 'new,middle,old', 'history should be sorted newest first');
}

function limitsHistoryToTheConfiguredMaximum() {
  const records = normalizeSyncHistoryRecords([
    record({ id: 'third', timestamp: 30 }),
    record({ id: 'first', timestamp: 10 }),
    record({ id: 'second', timestamp: 20 }),
  ], 2);

  assertEqual(records.length, 2, 'history should be limited to configured maximum');
  assertEqual(records.map(item => item.id).join(','), 'third,second', 'history limit should keep the newest records');
}

function usesDefaultLimitForInvalidMaximums() {
  const records = normalizeSyncHistoryRecords(
    Array.from({ length: 101 }, (_, index) => record({ id: `record-${index}`, timestamp: index })),
    0,
  );

  assertEqual(records.length, 100, 'invalid maximum should fall back to the default history limit');
}

function record(overrides: Partial<SyncHistoryRecord> = {}): SyncHistoryRecord {
  return {
    id: 'record',
    timestamp: 1,
    operation: 'upload',
    status: 'success',
    storageType: 'gist',
    deviceName: 'Test Device',
    message: 'ok',
    ...overrides,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
