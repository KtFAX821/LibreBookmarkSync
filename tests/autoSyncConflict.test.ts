// SPDX-License-Identifier: Apache-2.0

import { normalizePendingAutoSyncConflict } from '../src/sync/autoSyncConflict';

runTests();

function runTests() {
  acceptsValidPendingConflicts();
  rejectsMissingOrNonObjectValues();
  rejectsInvalidTimestamps();
  rejectsInvalidMessages();
  rejectsInvalidChangeFlags();
  rejectsInvalidRemoteHashes();
  normalizesNumericStringTimestamps();
  console.log('autoSyncConflict tests passed');
}

function acceptsValidPendingConflicts() {
  const result = normalizePendingAutoSyncConflict({
    blockedAt: 1780910000000,
    message: 'Remote storage changed and local bookmarks also changed.',
    localChanged: true,
    previousRemoteHash: 'old-hash',
    currentRemoteHash: 'new-hash',
  });

  assertEqual(result?.blockedAt, 1780910000000, 'valid conflict should preserve blockedAt');
  assertEqual(result?.message, 'Remote storage changed and local bookmarks also changed.', 'valid conflict should preserve message');
  assertEqual(result?.localChanged, true, 'valid conflict should preserve localChanged');
  assertEqual(result?.previousRemoteHash, 'old-hash', 'valid conflict should preserve previous hash');
  assertEqual(result?.currentRemoteHash, 'new-hash', 'valid conflict should preserve current hash');
}

function rejectsMissingOrNonObjectValues() {
  assertEqual(normalizePendingAutoSyncConflict(null), null, 'null should not be a pending conflict');
  assertEqual(normalizePendingAutoSyncConflict(undefined), null, 'undefined should not be a pending conflict');
  assertEqual(normalizePendingAutoSyncConflict('conflict'), null, 'strings should not be pending conflicts');
  assertEqual(normalizePendingAutoSyncConflict([]), null, 'arrays should not be pending conflicts');
}

function rejectsInvalidTimestamps() {
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ blockedAt: 0 })), null, 'zero timestamp should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ blockedAt: -1 })), null, 'negative timestamp should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ blockedAt: 'later' })), null, 'non-numeric timestamp should be rejected');
}

function rejectsInvalidMessages() {
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ message: '' })), null, 'empty message should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ message: '   ' })), null, 'blank message should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ message: 12 })), null, 'non-string message should be rejected');
}

function rejectsInvalidChangeFlags() {
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ localChanged: 'true' })), null, 'string change flag should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ localChanged: 1 })), null, 'numeric change flag should be rejected');
}

function rejectsInvalidRemoteHashes() {
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ previousRemoteHash: '' })), null, 'empty previous hash should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ currentRemoteHash: '' })), null, 'empty current hash should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ previousRemoteHash: null })), null, 'non-string previous hash should be rejected');
  assertEqual(normalizePendingAutoSyncConflict(validConflict({ currentRemoteHash: null })), null, 'non-string current hash should be rejected');
}

function normalizesNumericStringTimestamps() {
  const result = normalizePendingAutoSyncConflict(validConflict({ blockedAt: '1780910000000' }));
  assertEqual(result?.blockedAt, 1780910000000, 'numeric string timestamps should normalize to numbers');
}

function validConflict(overrides: Record<string, unknown>) {
  return {
    blockedAt: 1780910000000,
    message: 'Remote storage changed and local bookmarks also changed.',
    localChanged: true,
    previousRemoteHash: 'old-hash',
    currentRemoteHash: 'new-hash',
    ...overrides,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
