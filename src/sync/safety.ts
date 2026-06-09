// SPDX-License-Identifier: Apache-2.0

export interface PendingAutoSyncSafety {
  blockedAt: number;
  localCount: number;
  previousRemoteCount: number;
  deletedCount: number;
  deletedPercent: number;
  threshold: number;
}

export interface AutoUploadSafetyRuleInput {
  enableSafeMode: boolean;
  localBookmarkCount: number;
  previousRemoteCount: number;
  safeModeDeleteThreshold?: number;
}

const PENDING_AUTO_SYNC_SAFETY_KEY = 'pendingAutoSyncSafety';

export function normalizePendingAutoSyncSafety(value: unknown): PendingAutoSyncSafety | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<PendingAutoSyncSafety>;
  const blockedAt = Number(record.blockedAt);
  const localCount = Number(record.localCount);
  const previousRemoteCount = Number(record.previousRemoteCount);
  const deletedCount = Number(record.deletedCount);
  const deletedPercent = Number(record.deletedPercent);
  const threshold = Number(record.threshold);

  if (!isPositiveFiniteNumber(blockedAt)) {
    return null;
  }

  if (!isNonNegativeFiniteNumber(localCount) || !isNonNegativeFiniteNumber(previousRemoteCount)) {
    return null;
  }

  if (!isPositiveFiniteNumber(deletedCount) || !isPositiveFiniteNumber(deletedPercent)) {
    return null;
  }

  if (!isPositiveFiniteNumber(threshold)) {
    return null;
  }

  return {
    blockedAt,
    localCount,
    previousRemoteCount,
    deletedCount,
    deletedPercent,
    threshold,
  };
}

export async function assertAutoUploadIsSafe(localBookmarkCount: number) {
  const { Setting } = await import('../utils/setting');
  const setting = await Setting.build();
  const previousRemoteCount = await getPreviousRemoteCount();
  const safety = evaluateAutoUploadSafety({
    enableSafeMode: setting.enableSafeMode,
    localBookmarkCount,
    previousRemoteCount,
    safeModeDeleteThreshold: setting.safeModeDeleteThreshold,
  });
  if (!safety) {
    return;
  }

  const pendingSafety: PendingAutoSyncSafety = {
    blockedAt: Date.now(),
    ...safety,
  };

  await browser.storage.local.set({
    [PENDING_AUTO_SYNC_SAFETY_KEY]: pendingSafety,
  });
  const {
    setExtensionBadgeBackgroundColor,
    setExtensionBadgeText,
  } = await import('../utils/extensionAction');
  await setExtensionBadgeText('!');
  await setExtensionBadgeBackgroundColor('#F59E0B');

  throw new Error(
    `Auto sync blocked: ${pendingSafety.deletedCount} bookmarks would be removed (${pendingSafety.deletedPercent.toFixed(1)}%).`,
  );
}

export function evaluateAutoUploadSafety(input: AutoUploadSafetyRuleInput) {
  if (!input.enableSafeMode) {
    return null;
  }

  const localBookmarkCount = Number(input.localBookmarkCount);
  const previousRemoteCount = Number(input.previousRemoteCount);
  if (!isNonNegativeFiniteNumber(localBookmarkCount) || !isPositiveFiniteNumber(previousRemoteCount)) {
    return null;
  }

  const deletedCount = previousRemoteCount - localBookmarkCount;
  if (deletedCount <= 10) {
    return null;
  }

  const deletedPercent = (deletedCount / previousRemoteCount) * 100;
  if (!isPositiveFiniteNumber(deletedPercent)) {
    return null;
  }

  const configuredThreshold = Number(input.safeModeDeleteThreshold);
  const threshold = isPositiveFiniteNumber(configuredThreshold) ? configuredThreshold : 20;
  if (deletedPercent < threshold) {
    return null;
  }

  return {
    localCount: localBookmarkCount,
    previousRemoteCount,
    deletedCount,
    deletedPercent,
    threshold,
  };
}

export async function clearPendingAutoSyncSafety() {
  await browser.storage.local.remove(PENDING_AUTO_SYNC_SAFETY_KEY);
}

export async function hasPendingAutoSyncSafety() {
  const result = await browser.storage.local.get(PENDING_AUTO_SYNC_SAFETY_KEY);
  return Boolean(normalizePendingAutoSyncSafety(result[PENDING_AUTO_SYNC_SAFETY_KEY]));
}

export async function getPendingAutoSyncSafety() {
  const result = await browser.storage.local.get(PENDING_AUTO_SYNC_SAFETY_KEY);
  return normalizePendingAutoSyncSafety(result[PENDING_AUTO_SYNC_SAFETY_KEY]);
}

async function getPreviousRemoteCount() {
  const result = await browser.storage.local.get('remoteCount');
  const count = Number(result.remoteCount);
  return isNonNegativeFiniteNumber(count) ? count : 0;
}

function isPositiveFiniteNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: number) {
  return Number.isFinite(value) && value >= 0;
}
