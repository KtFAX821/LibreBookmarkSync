// SPDX-License-Identifier: Apache-2.0

export const AUTO_SYNC_ALARM_NAME = 'libre-bookmark-sync-auto';

const AUTO_SYNC_SETTING_KEYS = new Set([
  'enableAutoSync',
  'syncIntervalMinutes',
]);

export function isAutoSyncAlarm(name: string) {
  return name === AUTO_SYNC_ALARM_NAME;
}

export function shouldReconfigureAutoSyncAlarm(changes: Record<string, unknown>) {
  return Object.keys(changes).some(key => AUTO_SYNC_SETTING_KEYS.has(key));
}

export function normalizeAutoSyncIntervalMinutes(intervalMinutes: number | undefined) {
  return Math.max(5, intervalMinutes || 10);
}
