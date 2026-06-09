// SPDX-License-Identifier: Apache-2.0

import { compressToUTF16 } from 'lz-string';
import {
  decodeSnapshotBookmarks,
  encodeSnapshotBookmarks,
  MAX_BOOKMARK_SNAPSHOT_RECORDS,
  normalizeBookmarkSnapshots,
  type BookmarkSnapshot,
} from '../src/history/bookmarkSnapshotData';
import { BookmarkInfo } from '../src/utils/models';

runTests();

function runTests() {
  roundTripsSnapshotBookmarks();
  rejectsCorruptSnapshotContent();
  rejectsNonArraySnapshotPayloads();
  returnsEmptySnapshotsForMissingOrCorruptStorage();
  keepsOnlyValidSnapshotRecords();
  sortsNewestSnapshotsFirst();
  limitsSnapshotsToTheConfiguredMaximum();
  usesDefaultLimitForInvalidMaximums();
  console.log('bookmarkSnapshotData tests passed');
}

function roundTripsSnapshotBookmarks() {
  const bookmarks = [
    new BookmarkInfo('Folder', undefined, [
      new BookmarkInfo('Example', 'https://example.com'),
    ]),
  ];

  const compressedBookmarks = encodeSnapshotBookmarks(bookmarks);
  const decoded = decodeSnapshotBookmarks({ compressedBookmarks });

  assertEqual(decoded.length, 1, 'decoded snapshot should preserve root folder count');
  assertEqual(decoded[0].title, 'Folder', 'decoded snapshot should preserve folder title');
  assertEqual(decoded[0].children?.[0]?.url, 'https://example.com', 'decoded snapshot should preserve bookmark URL');
}

function rejectsCorruptSnapshotContent() {
  assertThrows(
    () => decodeSnapshotBookmarks({ compressedBookmarks: 'not compressed data' }),
    'corrupt snapshot content should be rejected',
  );
}

function rejectsNonArraySnapshotPayloads() {
  const objectPayload = encodeObjectPayload();
  assertThrows(
    () => decodeSnapshotBookmarks({ compressedBookmarks: objectPayload }),
    'object snapshot payload should be rejected',
  );
}

function returnsEmptySnapshotsForMissingOrCorruptStorage() {
  assertEqual(normalizeBookmarkSnapshots(undefined).length, 0, 'missing snapshots should become empty');
  assertEqual(normalizeBookmarkSnapshots({}).length, 0, 'object snapshots should become empty');
  assertEqual(normalizeBookmarkSnapshots('bad').length, 0, 'string snapshots should become empty');
}

function keepsOnlyValidSnapshotRecords() {
  const snapshots = normalizeBookmarkSnapshots([
    snapshot({ id: 'valid' }),
    snapshot({ id: '' }),
    snapshot({ reason: 'unknown' as never }),
    snapshot({ timestamp: Number.NaN }),
    snapshot({ bookmarkCount: -1 }),
    snapshot({ deviceName: '' }),
    snapshot({ browser: '' }),
    snapshot({ compressedBookmarks: '' }),
    snapshot({ compressedBookmarks: 'not compressed data' }),
    snapshot({ compressedBookmarks: encodeObjectPayload() }),
    null,
  ]);

  assertEqual(snapshots.length, 1, 'only one valid snapshot should remain');
  assertEqual(snapshots[0].id, 'valid', 'valid snapshot should be preserved');
}

function sortsNewestSnapshotsFirst() {
  const snapshots = normalizeBookmarkSnapshots([
    snapshot({ id: 'old', timestamp: 100 }),
    snapshot({ id: 'new', timestamp: 300 }),
    snapshot({ id: 'middle', timestamp: 200 }),
  ]);

  assertEqual(snapshots.map(item => item.id).join(','), 'new,middle,old', 'snapshots should be sorted newest first');
}

function limitsSnapshotsToTheConfiguredMaximum() {
  const snapshots = normalizeBookmarkSnapshots([
    snapshot({ id: 'third', timestamp: 30 }),
    snapshot({ id: 'first', timestamp: 10 }),
    snapshot({ id: 'second', timestamp: 20 }),
  ], 2);

  assertEqual(snapshots.length, 2, 'snapshots should be limited to configured maximum');
  assertEqual(snapshots.map(item => item.id).join(','), 'third,second', 'snapshot limit should keep the newest records');
}

function usesDefaultLimitForInvalidMaximums() {
  const snapshots = normalizeBookmarkSnapshots(
    Array.from(
      { length: MAX_BOOKMARK_SNAPSHOT_RECORDS + 1 },
      (_, index) => snapshot({ id: `snapshot-${index}`, timestamp: index }),
    ),
    0,
  );

  assertEqual(
    snapshots.length,
    MAX_BOOKMARK_SNAPSHOT_RECORDS,
    'invalid maximum should fall back to the default snapshot limit',
  );
}

function snapshot(overrides: Partial<BookmarkSnapshot> = {}): BookmarkSnapshot {
  return {
    id: 'snapshot',
    timestamp: 1,
    reason: 'beforeDownload',
    bookmarkCount: 1,
    deviceName: 'Test Device',
    browser: 'Test Browser',
    compressedBookmarks: encodeSnapshotBookmarks([new BookmarkInfo('Example', 'https://example.com')]),
    ...overrides,
  };
}

function encodeObjectPayload() {
  return compressToUTF16(JSON.stringify({ bookmarks: [] })) || '';
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
