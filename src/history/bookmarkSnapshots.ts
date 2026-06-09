// SPDX-License-Identifier: Apache-2.0

import {
  clearBookmarkTree,
  countBookmarks,
  createBookmarkTree,
  formatBookmarksForSync,
  getBookmarkTree,
} from '../bookmarks/bookmarkTree';
import { Setting } from '../utils/setting';
import {
  BookmarkSnapshot,
  BookmarkSnapshotReason,
  decodeSnapshotBookmarks,
  encodeSnapshotBookmarks,
  normalizeBookmarkSnapshots,
} from './bookmarkSnapshotData';

export type { BookmarkSnapshot, BookmarkSnapshotReason };

const SNAPSHOT_KEY = 'bookmarkSnapshots';

export async function createBookmarkSnapshot(reason: BookmarkSnapshotReason) {
  const setting = await Setting.build();
  const { bookmarkTree } = await getBookmarkTree();
  const bookmarks = formatBookmarksForSync(bookmarkTree);
  const snapshot: BookmarkSnapshot = {
    id: createSnapshotId(),
    timestamp: Date.now(),
    reason,
    bookmarkCount: countBookmarks(bookmarks),
    deviceName: setting.deviceName || getFallbackDeviceName(),
    browser: navigator.userAgent || 'Unknown Browser',
    compressedBookmarks: encodeSnapshotBookmarks(bookmarks),
  };

  const snapshots = await getBookmarkSnapshots();
  await browser.storage.local.set({
    [SNAPSHOT_KEY]: normalizeBookmarkSnapshots([snapshot, ...snapshots]),
  });

  return snapshot;
}

export async function getBookmarkSnapshots() {
  const result = await browser.storage.local.get(SNAPSHOT_KEY);
  return normalizeBookmarkSnapshots(result[SNAPSHOT_KEY]);
}

export async function clearBookmarkSnapshots() {
  await browser.storage.local.set({
    [SNAPSHOT_KEY]: [],
  });
}

export async function restoreBookmarkSnapshot(snapshotId: string) {
  const snapshots = await getBookmarkSnapshots();
  const snapshot = snapshots.find(item => item.id === snapshotId);
  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  const restoredBookmarks = decodeSnapshotBookmarks(snapshot);
  const { browserType } = await getBookmarkTree();

  await createBookmarkSnapshot('beforeRestore');
  await clearBookmarkTree();
  await createBookmarkTree(restoredBookmarks, browserType);
  await browser.storage.local.set({
    localCount: countBookmarks(restoredBookmarks),
  });

  return snapshot;
}

function createSnapshotId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFallbackDeviceName() {
  return navigator.userAgent || 'Unknown Device';
}
