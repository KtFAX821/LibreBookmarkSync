// SPDX-License-Identifier: Apache-2.0

import { Setting } from '../utils/setting';
import { SyncDataInfo } from '../utils/models';
import {
  clearBookmarkTree,
  countBookmarks,
  countSyncableBookmarks,
  createBookmarkTree,
  filterSyncableBookmarkRoots,
  formatBookmarksForSync,
  getBookmarkTree,
} from '../bookmarks/bookmarkTree';
import { notifyError, notifyMessage, notifySuccess } from '../notifications/extensionNotifications';
import { createStorageAdapter } from '../storage/storageFactory';
import { SyncOperationType, addSyncHistoryRecord } from '../history/syncHistory';
import { createBookmarkSnapshot, restoreBookmarkSnapshot } from '../history/bookmarkSnapshots';
import { parseSyncDocument, serializeSyncDocument } from './syncDocument';
import { assertAutoUploadIsSafe, clearPendingAutoSyncSafety } from './safety';
import { hashBookmarks, saveBookmarkSyncState } from './syncState';
import { clearPendingAutoSyncConflict } from './autoSyncConflict';

export async function uploadBookmarksToStorage(operation: SyncOperationType = 'upload') {
  let bookmarkCount = 0;
  try {
    const setting = await Setting.build();
    const storage = createStorageAdapter(setting);
    const { bookmarkTree } = await getBookmarkTree();
    const syncData = new SyncDataInfo();
    syncData.version = browser.runtime.getManifest().version;
    syncData.createDate = Date.now();
    syncData.bookmarks = formatBookmarksForSync(bookmarkTree);
    syncData.browser = navigator.userAgent;
    bookmarkCount = countBookmarks(syncData.bookmarks);
    const bookmarkHash = await hashBookmarks(syncData.bookmarks);

    if (operation === 'auto') {
      await assertAutoUploadIsSafe(bookmarkCount);
    } else {
      await clearPendingAutoSyncSafety();
      await clearPendingAutoSyncConflict();
    }

    await storage.upload(await serializeSyncDocument(syncData, setting), setting.gistFileName);
    await saveBookmarkSyncState(bookmarkHash, bookmarkHash, syncData.bookmarks);

    await browser.storage.local.set({
      remoteCount: bookmarkCount,
    });
    await addSyncHistoryRecord({
      operation,
      status: 'success',
      message: operation === 'auto'
        ? 'Auto synced bookmarks to remote storage'
        : 'Uploaded bookmarks to remote storage',
      bookmarkCount,
    });
    await notifySuccess('uploadBookmarks');
  } catch (error) {
    console.error(error);
    await addSyncHistoryRecord({
      operation,
      status: 'failure',
      message: getErrorMessage(error),
      bookmarkCount,
    });
    await notifyError('uploadBookmarks', error);
    throw error;
  }
}

export async function downloadBookmarksFromStorage(operation: SyncOperationType = 'download') {
  let bookmarkCount = 0;
  try {
    const setting = await Setting.build();
    const storage = createStorageAdapter(setting);
    const remoteContent = await storage.download();
    if (!remoteContent) {
      throw new Error('Remote bookmark file not found');
    }

    const syncData = await parseSyncDocument(remoteContent, setting);
    const syncedBookmarks = filterSyncableBookmarkRoots(syncData.bookmarks);
    if (syncedBookmarks.length === 0) {
      throw new Error('Remote bookmark file is empty');
    }

    const { browserType } = await getBookmarkTree();
    await createBookmarkSnapshot('beforeDownload');
    await clearBookmarkTree();
    await createBookmarkTree(cloneBookmarks(syncedBookmarks), browserType);
    bookmarkCount = countBookmarks(syncedBookmarks);
    const bookmarkHash = await hashBookmarks(syncedBookmarks);
    await saveBookmarkSyncState(bookmarkHash, bookmarkHash, syncedBookmarks);
    await clearPendingAutoSyncConflict();
    await browser.storage.local.set({
      remoteCount: bookmarkCount,
    });
    await addSyncHistoryRecord({
      operation,
      status: 'success',
      message: operation === 'auto'
        ? 'Auto downloaded remote bookmark changes'
        : 'Downloaded bookmarks from remote storage',
      bookmarkCount,
    });
    await notifySuccess('downloadBookmarks');
  } catch (error) {
    console.error(error);
    await addSyncHistoryRecord({
      operation,
      status: 'failure',
      message: getErrorMessage(error),
      bookmarkCount,
    });
    await notifyError('downloadBookmarks', error);
    throw error;
  }
}

export async function removeAllLocalBookmarks(showSuccessNotification: boolean) {
  try {
    await createBookmarkSnapshot('beforeRemoveAll');
    await clearBookmarkTree();
    await addSyncHistoryRecord({
      operation: 'removeAll',
      status: 'success',
      message: 'Removed all local bookmarks',
    });
    if (showSuccessNotification) {
      await notifySuccess('removeAllBookmarks');
    }
  } catch (error) {
    console.error(error);
    await addSyncHistoryRecord({
      operation: 'removeAll',
      status: 'failure',
      message: getErrorMessage(error),
    });
    await notifyError('removeAllBookmarks', error);
    throw error;
  }
}

export async function restoreLocalBookmarksFromSnapshot(snapshotId: string) {
  let bookmarkCount = 0;
  try {
    const snapshot = await restoreBookmarkSnapshot(snapshotId);
    bookmarkCount = snapshot.bookmarkCount;
    await addSyncHistoryRecord({
      operation: 'restore',
      status: 'success',
      message: `Restored local bookmarks from snapshot ${new Date(snapshot.timestamp).toLocaleString()}`,
      bookmarkCount,
    });
    await notifyMessage('downloadBookmarks', 'Restored bookmarks from local snapshot');
  } catch (error) {
    console.error(error);
    await addSyncHistoryRecord({
      operation: 'restore',
      status: 'failure',
      message: getErrorMessage(error),
      bookmarkCount,
    });
    await notifyError('downloadBookmarks', error);
    throw error;
  }
}

export async function refreshLocalBookmarkCount() {
  const { bookmarkTree } = await getBookmarkTree();
  await browser.storage.local.set({
    localCount: countSyncableBookmarks(bookmarkTree),
  });
}

export const uploadBookmarksToGist = uploadBookmarksToStorage;
export const downloadBookmarksFromGist = downloadBookmarksFromStorage;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function cloneBookmarks(bookmarks: SyncDataInfo['bookmarks']) {
  return JSON.parse(JSON.stringify(bookmarks || [])) as NonNullable<SyncDataInfo['bookmarks']>;
}
