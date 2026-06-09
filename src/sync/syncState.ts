// SPDX-License-Identifier: Apache-2.0

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { BookmarkInfo } from '../utils/models';

export interface BookmarkSyncState {
  localHash: string;
  remoteHash: string;
  updatedAt: number;
  baseBookmarksCompressed?: string;
}

const SYNC_STATE_KEY = 'bookmarkSyncState';

export async function getBookmarkSyncState() {
  const result = await browser.storage.local.get(SYNC_STATE_KEY);
  return (result[SYNC_STATE_KEY] || null) as BookmarkSyncState | null;
}

export async function saveBookmarkSyncState(
  localHash: string,
  remoteHash = localHash,
  syncedBookmarks?: BookmarkInfo[],
) {
  const state: BookmarkSyncState = {
    localHash,
    remoteHash,
    updatedAt: Date.now(),
  };

  if (syncedBookmarks) {
    state.baseBookmarksCompressed = compressToUTF16(JSON.stringify(syncedBookmarks));
  }

  await browser.storage.local.set({
    [SYNC_STATE_KEY]: state,
  });

  return state;
}

export function getBaseBookmarksFromSyncState(syncState: BookmarkSyncState | null) {
  if (!syncState?.baseBookmarksCompressed) {
    return null;
  }

  const decompressed = decompressFromUTF16(syncState.baseBookmarksCompressed);
  if (!decompressed) {
    return null;
  }

  try {
    const parsed = JSON.parse(decompressed);
    return Array.isArray(parsed) ? parsed as BookmarkInfo[] : null;
  } catch {
    return null;
  }
}

export async function hashBookmarks(bookmarks: BookmarkInfo[] | undefined) {
  const payload = JSON.stringify(bookmarks || []);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
