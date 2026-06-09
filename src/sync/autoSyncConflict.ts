// SPDX-License-Identifier: Apache-2.0

import {
  setExtensionBadgeBackgroundColor,
  setExtensionBadgeText,
} from '../utils/extensionAction';

export interface PendingAutoSyncConflict {
  blockedAt: number;
  message: string;
  localChanged: boolean;
  previousRemoteHash: string;
  currentRemoteHash: string;
}

const PENDING_AUTO_SYNC_CONFLICT_KEY = 'pendingAutoSyncConflict';

export function normalizePendingAutoSyncConflict(value: unknown): PendingAutoSyncConflict | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<PendingAutoSyncConflict>;
  const blockedAt = Number(record.blockedAt);
  if (!Number.isFinite(blockedAt) || blockedAt <= 0) {
    return null;
  }

  if (typeof record.message !== 'string' || record.message.trim().length === 0) {
    return null;
  }

  if (typeof record.localChanged !== 'boolean') {
    return null;
  }

  if (typeof record.previousRemoteHash !== 'string' || record.previousRemoteHash.length === 0) {
    return null;
  }

  if (typeof record.currentRemoteHash !== 'string' || record.currentRemoteHash.length === 0) {
    return null;
  }

  return {
    blockedAt,
    message: record.message,
    localChanged: record.localChanged,
    previousRemoteHash: record.previousRemoteHash,
    currentRemoteHash: record.currentRemoteHash,
  };
}

export async function setPendingAutoSyncConflict(conflict: Omit<PendingAutoSyncConflict, 'blockedAt'>) {
  const pendingConflict: PendingAutoSyncConflict = {
    blockedAt: Date.now(),
    ...conflict,
  };

  await browser.storage.local.set({
    [PENDING_AUTO_SYNC_CONFLICT_KEY]: pendingConflict,
  });
  await setExtensionBadgeText('!');
  await setExtensionBadgeBackgroundColor('#F59E0B');
  return pendingConflict;
}

export async function clearPendingAutoSyncConflict() {
  await browser.storage.local.remove(PENDING_AUTO_SYNC_CONFLICT_KEY);
}

export async function hasPendingAutoSyncConflict() {
  const result = await browser.storage.local.get(PENDING_AUTO_SYNC_CONFLICT_KEY);
  return Boolean(normalizePendingAutoSyncConflict(result[PENDING_AUTO_SYNC_CONFLICT_KEY]));
}

export async function getPendingAutoSyncConflict() {
  const result = await browser.storage.local.get(PENDING_AUTO_SYNC_CONFLICT_KEY);
  return normalizePendingAutoSyncConflict(result[PENDING_AUTO_SYNC_CONFLICT_KEY]);
}
