// SPDX-License-Identifier: Apache-2.0

import {
  AUTO_SYNC_ALARM_NAME,
  isAutoSyncAlarm,
  normalizeAutoSyncIntervalMinutes,
  shouldReconfigureAutoSyncAlarm,
} from '../src/sync/autoSyncSchedule';

runTests();

function runTests() {
  matchesOnlyTheLibreBookmarkSyncAlarm();
  reconfiguresOnlyForAutoSyncSettings();
  normalizesAutoSyncIntervals();
  console.log('autoSyncSchedule tests passed');
}

function matchesOnlyTheLibreBookmarkSyncAlarm() {
  assertEqual(isAutoSyncAlarm(AUTO_SYNC_ALARM_NAME), true, 'known auto-sync alarm should match');
  assertEqual(isAutoSyncAlarm('other-alarm'), false, 'unrelated alarms should not match');
  assertEqual(isAutoSyncAlarm('LibreBookmarkSync-auto'), false, 'alarm matching should be exact');
}

function reconfiguresOnlyForAutoSyncSettings() {
  assertEqual(
    shouldReconfigureAutoSyncAlarm({ enableAutoSync: { newValue: true } }),
    true,
    'enableAutoSync changes should reconfigure alarms',
  );
  assertEqual(
    shouldReconfigureAutoSyncAlarm({ syncIntervalMinutes: { newValue: 15 } }),
    true,
    'syncIntervalMinutes changes should reconfigure alarms',
  );
  assertEqual(
    shouldReconfigureAutoSyncAlarm({ deviceName: { newValue: 'Laptop' } }),
    false,
    'unrelated settings should not reconfigure alarms',
  );
  assertEqual(
    shouldReconfigureAutoSyncAlarm({}),
    false,
    'empty changes should not reconfigure alarms',
  );
}

function normalizesAutoSyncIntervals() {
  assertEqual(normalizeAutoSyncIntervalMinutes(undefined), 10, 'missing interval should use the default');
  assertEqual(normalizeAutoSyncIntervalMinutes(0), 10, 'zero interval should use the default');
  assertEqual(normalizeAutoSyncIntervalMinutes(1), 5, 'short intervals should be raised to five minutes');
  assertEqual(normalizeAutoSyncIntervalMinutes(5), 5, 'five minutes should be accepted');
  assertEqual(normalizeAutoSyncIntervalMinutes(30), 30, 'longer intervals should be preserved');
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
