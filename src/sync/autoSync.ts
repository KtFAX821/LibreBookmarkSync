// SPDX-License-Identifier: Apache-2.0

import { Setting } from '../utils/setting';
import {
  clearBookmarkTree,
  countBookmarks,
  createBookmarkTree,
  filterSyncableBookmarkRoots,
  formatBookmarksForSync,
  getBookmarkTree,
} from '../bookmarks/bookmarkTree';
import { createBookmarkSnapshot } from '../history/bookmarkSnapshots';
import { addSyncHistoryRecord } from '../history/syncHistory';
import { notifyMessage } from '../notifications/extensionNotifications';
import { createStorageAdapter } from '../storage/storageFactory';
import { downloadBookmarksFromStorage, uploadBookmarksToStorage } from './manualGistSync';
import { parseSyncDocument, serializeSyncDocument } from './syncDocument';
import {
  getBaseBookmarksFromSyncState,
  getBookmarkSyncState,
  hashBookmarks,
  saveBookmarkSyncState,
} from './syncState';
import { clearPendingAutoSyncConflict } from './autoSyncConflict';
import { createMergeHistoryMessage, mergeBookmarksWithBase } from './bookmarkMerge';
import { SyncDataInfo } from '../utils/models';
import { clearPendingAutoSyncSafety } from './safety';
import {
  setExtensionBadgeBackgroundColor,
  setExtensionBadgeText,
} from '../utils/extensionAction';
import {
  AUTO_SYNC_ALARM_NAME,
  isAutoSyncAlarm,
  normalizeAutoSyncIntervalMinutes,
  shouldReconfigureAutoSyncAlarm,
} from './autoSyncSchedule';

export {
  AUTO_SYNC_ALARM_NAME,
  isAutoSyncAlarm,
  shouldReconfigureAutoSyncAlarm,
};

export async function configureAutoSyncAlarm() {
  const setting = await Setting.build();
  await browser.alarms.clear(AUTO_SYNC_ALARM_NAME);

  if (!setting.enableAutoSync) {
    return;
  }

  const periodInMinutes = normalizeAutoSyncIntervalMinutes(setting.syncIntervalMinutes);
  await browser.alarms.create(AUTO_SYNC_ALARM_NAME, {
    periodInMinutes,
  });
}

export async function runAutoSyncUpload() {
  if (!await prepareAutoSyncUpload()) {
    return;
  }

  await uploadBookmarksToStorage('auto');
}

async function prepareAutoSyncUpload() {
  try {
    const setting = await Setting.build();
    const storage = createStorageAdapter(setting);
    const remoteContent = await storage.download();
    if (!remoteContent) {
      return true;
    }

    const syncData = await parseSyncDocument(remoteContent, setting);
    const remoteBookmarks = filterSyncableBookmarkRoots(syncData.bookmarks);
    const remoteHash = await hashBookmarks(remoteBookmarks);
    const syncState = await getBookmarkSyncState();
    if (!syncState || syncState.remoteHash === remoteHash) {
      return true;
    }

    const { bookmarkTree } = await getBookmarkTree();
    const localHash = await hashBookmarks(formatBookmarksForSync(bookmarkTree));
    const localChanged = localHash !== syncState.localHash;
    if (!localChanged) {
      await downloadBookmarksFromStorage('auto');
      return false;
    }

    await mergeLocalAndRemoteBookmarks(
      setting,
      filterSyncableBaseBookmarks(getBaseBookmarksFromSyncState(syncState) || undefined),
      remoteBookmarks,
      formatBookmarksForSync(bookmarkTree),
    );
    return false;
  } catch (error) {
    const message = `Auto sync paused: ${error instanceof Error ? error.message : String(error)}`;
    await setExtensionBadgeText('!');
    await setExtensionBadgeBackgroundColor('#F59E0B');
    await addSyncHistoryRecord({
      operation: 'auto',
      status: 'failure',
      message,
    });
    await notifyMessage('syncBookmarks', message);
    return false;
  }
}

async function mergeLocalAndRemoteBookmarks(
  setting: Setting,
  baseBookmarks: SyncDataInfo['bookmarks'],
  remoteBookmarks: SyncDataInfo['bookmarks'],
  localBookmarks: SyncDataInfo['bookmarks'],
) {
  const { bookmarks, summary } = mergeBookmarksWithBase(baseBookmarks, localBookmarks, remoteBookmarks);
  const syncedBookmarks = cloneBookmarks(bookmarks);
  const { browserType } = await getBookmarkTree();
  const bookmarkCount = countBookmarks(syncedBookmarks);
  const bookmarkHash = await hashBookmarks(syncedBookmarks);
  const syncData = new SyncDataInfo();
  syncData.version = browser.runtime.getManifest().version;
  syncData.createDate = Date.now();
  syncData.bookmarks = syncedBookmarks;
  syncData.browser = navigator.userAgent;
  const storage = createStorageAdapter(setting);
  const remoteDocument = await serializeSyncDocument(syncData, setting);

  await createBookmarkSnapshot('beforeAutoMerge');
  await clearBookmarkTree();
  await createBookmarkTree(cloneBookmarks(syncedBookmarks), browserType);
  await storage.upload(remoteDocument, setting.gistFileName);
  await saveBookmarkSyncState(bookmarkHash, bookmarkHash, syncedBookmarks);
  await clearPendingAutoSyncConflict();
  await clearPendingAutoSyncSafety();
  await browser.storage.local.set({
    remoteCount: bookmarkCount,
    localCount: bookmarkCount,
  });
  await addSyncHistoryRecord({
    operation: 'auto',
    status: 'success',
    message: createMergeHistoryMessage(summary),
    bookmarkCount,
  });
  await notifyMessage('syncBookmarks', 'Auto merged local and remote bookmark changes');
}

function cloneBookmarks(bookmarks: SyncDataInfo['bookmarks']) {
  return JSON.parse(JSON.stringify(bookmarks || [])) as NonNullable<SyncDataInfo['bookmarks']>;
}

function filterSyncableBaseBookmarks(bookmarks: SyncDataInfo['bookmarks']) {
  return bookmarks ? filterSyncableBookmarkRoots(bookmarks) : undefined;
}
