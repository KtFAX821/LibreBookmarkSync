// SPDX-License-Identifier: Apache-2.0

import {
  evaluateAutoUploadSafety,
  normalizePendingAutoSyncSafety,
} from '../src/sync/safety';

runTests();

function runTests() {
  allowsUploadsWhenSafeModeIsDisabled();
  allowsUploadsWithoutPreviousRemoteCount();
  allowsSmallAbsoluteDeletions();
  allowsDeletionsBelowPercentageThreshold();
  blocksLargeDeletionsAtTheDefaultThreshold();
  blocksLargeDeletionsAtACustomThreshold();
  ignoresInvalidNumericInputs();
  preservesRuleDetailsForThePendingWarning();
  acceptsValidPendingSafetyWarnings();
  rejectsCorruptPendingSafetyWarnings();
  normalizesNumericStringPendingSafetyValues();
  console.log('safety tests passed');
}

function allowsUploadsWhenSafeModeIsDisabled() {
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: false,
      localBookmarkCount: 10,
      previousRemoteCount: 100,
    }),
    null,
    'disabled safe mode should not block auto upload',
  );
}

function allowsUploadsWithoutPreviousRemoteCount() {
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: 0,
      previousRemoteCount: 0,
    }),
    null,
    'missing previous remote count should not block auto upload',
  );
}

function allowsSmallAbsoluteDeletions() {
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: 90,
      previousRemoteCount: 100,
    }),
    null,
    'ten or fewer deleted bookmarks should not block auto upload',
  );
}

function allowsDeletionsBelowPercentageThreshold() {
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: 85,
      previousRemoteCount: 100,
      safeModeDeleteThreshold: 20,
    }),
    null,
    'deletions below the percentage threshold should not block auto upload',
  );
}

function blocksLargeDeletionsAtTheDefaultThreshold() {
  const result = evaluateAutoUploadSafety({
    enableSafeMode: true,
    localBookmarkCount: 79,
    previousRemoteCount: 100,
  });

  assertEqual(Boolean(result), true, 'default threshold should block a 21 percent deletion');
  assertEqual(result?.threshold, 20, 'default threshold should be 20 percent');
}

function blocksLargeDeletionsAtACustomThreshold() {
  const result = evaluateAutoUploadSafety({
    enableSafeMode: true,
    localBookmarkCount: 84,
    previousRemoteCount: 100,
    safeModeDeleteThreshold: 15,
  });

  assertEqual(Boolean(result), true, 'custom threshold should block matching deletions');
  assertEqual(result?.threshold, 15, 'custom threshold should be preserved');
}

function ignoresInvalidNumericInputs() {
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: Number.NaN,
      previousRemoteCount: 100,
    }),
    null,
    'NaN local count should not create a pending warning',
  );
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: 10,
      previousRemoteCount: Number.NaN,
    }),
    null,
    'NaN previous remote count should not create a pending warning',
  );
  assertEqual(
    evaluateAutoUploadSafety({
      enableSafeMode: true,
      localBookmarkCount: 10,
      previousRemoteCount: 100,
      safeModeDeleteThreshold: Number.NaN,
    })?.threshold,
    20,
    'invalid threshold should fall back to the default',
  );
}

function preservesRuleDetailsForThePendingWarning() {
  const result = evaluateAutoUploadSafety({
    enableSafeMode: true,
    localBookmarkCount: 60,
    previousRemoteCount: 100,
    safeModeDeleteThreshold: 20,
  });

  assertEqual(result?.localCount, 60, 'pending warning should include local count');
  assertEqual(result?.previousRemoteCount, 100, 'pending warning should include previous remote count');
  assertEqual(result?.deletedCount, 40, 'pending warning should include deleted count');
  assertEqual(result?.deletedPercent, 40, 'pending warning should include deleted percent');
}

function acceptsValidPendingSafetyWarnings() {
  const result = normalizePendingAutoSyncSafety(validPendingSafety({}));

  assertEqual(result?.blockedAt, 1780910000000, 'valid safety warning should preserve blockedAt');
  assertEqual(result?.localCount, 60, 'valid safety warning should preserve local count');
  assertEqual(result?.previousRemoteCount, 100, 'valid safety warning should preserve previous remote count');
  assertEqual(result?.deletedCount, 40, 'valid safety warning should preserve deleted count');
  assertEqual(result?.deletedPercent, 40, 'valid safety warning should preserve deleted percent');
  assertEqual(result?.threshold, 20, 'valid safety warning should preserve threshold');
}

function rejectsCorruptPendingSafetyWarnings() {
  assertEqual(normalizePendingAutoSyncSafety(null), null, 'null should not be a pending safety warning');
  assertEqual(normalizePendingAutoSyncSafety('warning'), null, 'strings should not be pending safety warnings');
  assertEqual(normalizePendingAutoSyncSafety([]), null, 'arrays should not be pending safety warnings');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ blockedAt: 0 })), null, 'zero blockedAt should be rejected');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ localCount: Number.NaN })), null, 'NaN local count should be rejected');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ previousRemoteCount: -1 })), null, 'negative remote count should be rejected');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ deletedCount: 0 })), null, 'zero deleted count should be rejected');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ deletedPercent: Number.NaN })), null, 'NaN deleted percent should be rejected');
  assertEqual(normalizePendingAutoSyncSafety(validPendingSafety({ threshold: 0 })), null, 'zero threshold should be rejected');
}

function normalizesNumericStringPendingSafetyValues() {
  const result = normalizePendingAutoSyncSafety(validPendingSafety({
    blockedAt: '1780910000000',
    localCount: '60',
    previousRemoteCount: '100',
    deletedCount: '40',
    deletedPercent: '40',
    threshold: '20',
  }));

  assertEqual(result?.blockedAt, 1780910000000, 'numeric string blockedAt should normalize to a number');
  assertEqual(result?.localCount, 60, 'numeric string local count should normalize to a number');
  assertEqual(result?.previousRemoteCount, 100, 'numeric string previous remote count should normalize to a number');
  assertEqual(result?.deletedCount, 40, 'numeric string deleted count should normalize to a number');
  assertEqual(result?.deletedPercent, 40, 'numeric string deleted percent should normalize to a number');
  assertEqual(result?.threshold, 20, 'numeric string threshold should normalize to a number');
}

function validPendingSafety(overrides: Record<string, unknown>) {
  return {
    blockedAt: 1780910000000,
    localCount: 60,
    previousRemoteCount: 100,
    deletedCount: 40,
    deletedPercent: 40,
    threshold: 20,
    ...overrides,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
