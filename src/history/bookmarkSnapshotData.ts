// SPDX-License-Identifier: Apache-2.0

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { BookmarkInfo } from '../utils/models';

export type BookmarkSnapshotReason = 'beforeDownload' | 'beforeRemoveAll' | 'beforeRestore' | 'beforeAutoMerge';

export interface BookmarkSnapshot {
  id: string;
  timestamp: number;
  reason: BookmarkSnapshotReason;
  bookmarkCount: number;
  deviceName: string;
  browser: string;
  compressedBookmarks: string;
}

const SNAPSHOT_REASONS: BookmarkSnapshotReason[] = ['beforeDownload', 'beforeRemoveAll', 'beforeRestore', 'beforeAutoMerge'];
export const MAX_BOOKMARK_SNAPSHOT_RECORDS = 10;

export function encodeSnapshotBookmarks(bookmarks: BookmarkInfo[] | undefined) {
  return compressToUTF16(JSON.stringify(bookmarks || []));
}

export function decodeSnapshotBookmarks(snapshot: Pick<BookmarkSnapshot, 'compressedBookmarks'>) {
  const decompressed = decompressFromUTF16(snapshot.compressedBookmarks);
  if (!decompressed) {
    throw new Error('Snapshot is empty or corrupt');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decompressed);
  } catch {
    throw new Error('Snapshot is empty or corrupt');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Snapshot does not contain a bookmark array');
  }

  return parsed as BookmarkInfo[];
}

export function normalizeBookmarkSnapshots(
  rawSnapshots: unknown,
  maxSnapshots = MAX_BOOKMARK_SNAPSHOT_RECORDS,
) {
  if (!Array.isArray(rawSnapshots)) {
    return [];
  }

  return rawSnapshots
    .filter(isBookmarkSnapshot)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, normalizeMaxSnapshots(maxSnapshots));
}

function isBookmarkSnapshot(snapshot: unknown): snapshot is BookmarkSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  const candidate = snapshot as Partial<BookmarkSnapshot>;
  return (
    isNonEmptyString(candidate.id)
    && Number.isFinite(candidate.timestamp)
    && SNAPSHOT_REASONS.includes(candidate.reason as BookmarkSnapshotReason)
    && Number.isFinite(candidate.bookmarkCount)
    && Number(candidate.bookmarkCount) >= 0
    && isNonEmptyString(candidate.deviceName)
    && isNonEmptyString(candidate.browser)
    && isNonEmptyString(candidate.compressedBookmarks)
    && canDecodeBookmarkArray(candidate.compressedBookmarks)
  );
}

function normalizeMaxSnapshots(maxSnapshots: number) {
  if (!Number.isFinite(maxSnapshots) || maxSnapshots < 1) {
    return MAX_BOOKMARK_SNAPSHOT_RECORDS;
  }

  return Math.floor(maxSnapshots);
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canDecodeBookmarkArray(compressedBookmarks: string | undefined) {
  if (!compressedBookmarks) {
    return false;
  }

  try {
    decodeSnapshotBookmarks({ compressedBookmarks });
    return true;
  } catch {
    return false;
  }
}
