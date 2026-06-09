// SPDX-License-Identifier: Apache-2.0

import { OperType } from '../utils/models';
import {
  downloadBookmarksFromStorage,
  refreshLocalBookmarkCount,
  removeAllLocalBookmarks,
  restoreLocalBookmarksFromSnapshot,
  uploadBookmarksToStorage,
} from '../sync/manualGistSync';
import {
  configureAutoSyncAlarm,
  isAutoSyncAlarm,
  runAutoSyncUpload,
  shouldReconfigureAutoSyncAlarm,
} from '../sync/autoSync';
import { testCurrentStorageConnection } from '../storage/testStorage';
import {
  clearPendingAutoSyncSafety,
  getPendingAutoSyncSafety,
  hasPendingAutoSyncSafety,
} from '../sync/safety';
import {
  clearPendingAutoSyncConflict,
  getPendingAutoSyncConflict,
  hasPendingAutoSyncConflict,
} from '../sync/autoSyncConflict';
import {
  setExtensionBadgeBackgroundColor,
  setExtensionBadgeText,
} from '../utils/extensionAction';

export default defineBackground(() => {
  let currentOperation = OperType.NONE;

  configureAutoSyncAlarm();
  refreshLocalBookmarkCount();

  browser.runtime.onInstalled.addListener(() => {
    configureAutoSyncAlarm();
    refreshLocalBookmarkCount();
  });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.name) {
      case 'upload':
        sendOperationResponse(sendResponse, () => runBookmarkOperation(OperType.SYNC, uploadBookmarksToStorage));
        return true;

      case 'download':
        sendOperationResponse(sendResponse, () => runBookmarkOperation(OperType.SYNC, downloadBookmarksFromStorage));
        return true;

      case 'syncNow':
        sendOperationResponse(sendResponse, () => runBookmarkOperation(OperType.SYNC, runAutoSyncUpload));
        return true;

      case 'removeAll':
        sendOperationResponse(sendResponse, () => runBookmarkOperation(OperType.REMOVE, () => removeAllLocalBookmarks(true)));
        return true;

      case 'restoreSnapshot':
        sendOperationResponse(sendResponse, () => runBookmarkOperation(OperType.SYNC, () => restoreLocalBookmarksFromSnapshot(msg.snapshotId)));
        return true;

      case 'setting':
        sendOperationResponse(sendResponse, () => browser.runtime.openOptionsPage());
        return true;

      case 'testStorage':
        testCurrentStorageConnection()
          .then(message => {
            sendResponse({ success: true, message });
          })
          .catch(error => {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : String(error),
            });
          });
        return true;

      case 'getSafetyStatus':
        getPendingAutoSyncSafety().then(safety => {
          sendResponse({ success: true, safety });
        });
        return true;

      case 'clearSafetyStatus':
        clearPendingAutoSyncSafety()
          .then(async () => {
            await clearBadgeIfNoPendingWarnings();
            sendResponse({ success: true });
          })
          .catch(error => {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : String(error),
            });
          });
        return true;

      case 'getAutoSyncConflictStatus':
        getPendingAutoSyncConflict().then(conflict => {
          sendResponse({ success: true, conflict });
        });
        return true;

      case 'clearAutoSyncConflictStatus':
        clearPendingAutoSyncConflict()
          .then(async () => {
            await clearBadgeIfNoPendingWarnings();
            sendResponse({ success: true });
          })
          .catch(error => {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : String(error),
            });
          });
        return true;

      default:
        return false;
    }
  });

  browser.bookmarks.onCreated.addListener(() => {
    if (currentOperation === OperType.NONE) {
      markBookmarksChanged();
      refreshLocalBookmarkCount();
    }
  });

  browser.bookmarks.onChanged.addListener(() => {
    if (currentOperation === OperType.NONE) {
      markBookmarksChanged();
    }
  });

  browser.bookmarks.onMoved.addListener(() => {
    if (currentOperation === OperType.NONE) {
      markBookmarksChanged();
    }
  });

  browser.bookmarks.onRemoved.addListener(() => {
    if (currentOperation === OperType.NONE) {
      markBookmarksChanged();
      refreshLocalBookmarkCount();
    }
  });

  browser.alarms.onAlarm.addListener(alarm => {
    if (isAutoSyncAlarm(alarm.name) && currentOperation === OperType.NONE) {
      runBookmarkOperation(OperType.SYNC, runAutoSyncUpload).catch(error => {
        console.error(error);
      });
    }
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' || shouldReconfigureAutoSyncAlarm(changes)) {
      configureAutoSyncAlarm();
    }
  });

  async function runBookmarkOperation(operation: OperType, handler: () => Promise<void>) {
    currentOperation = operation;
    try {
      await handler();
    } finally {
      currentOperation = OperType.NONE;
      await clearBadgeIfNoPendingWarnings();
      await refreshLocalBookmarkCount();
    }
  }

  function sendOperationResponse(sendResponse: (response?: unknown) => void, handler: () => Promise<void>) {
    handler()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({
          success: false,
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async function clearBadgeIfNoPendingWarnings() {
    if (!(await hasPendingAutoSyncSafety()) && !(await hasPendingAutoSyncConflict())) {
      await setExtensionBadgeText('');
    }
  }

  function markBookmarksChanged() {
    setExtensionBadgeText('!');
    setExtensionBadgeBackgroundColor('#F00');
  }
});
