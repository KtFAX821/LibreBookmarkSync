// SPDX-License-Identifier: Apache-2.0

import { defaultAppSettings } from '../src/settings/appSettings';
import {
  migrateLegacyGistStorageType,
  normalizeAppLanguage,
  normalizeBooleanSetting,
  normalizeMaxHistoryRecords,
  normalizeSafeModeDeleteThreshold,
  normalizeStorageType,
  normalizeStringSetting,
  normalizeSyncIntervalMinutes,
} from '../src/settings/settingNormalization';

runTests();

function runTests() {
  normalizesStorageType();
  normalizesAppLanguage();
  migratesLegacyGistSettings();
  preservesValidNumericSettings();
  fallsBackForMissingNumericSettings();
  fallsBackForInvalidNumericSettings();
  normalizesStringSettings();
  normalizesBooleanSettings();
  console.log('settingNormalization tests passed');
}

function normalizesAppLanguage() {
  assertEqual(normalizeAppLanguage('auto'), 'auto', 'auto language should be preserved');
  assertEqual(normalizeAppLanguage('en'), 'en', 'English language should be preserved');
  assertEqual(normalizeAppLanguage('zh_CN'), 'zh_CN', 'Simplified Chinese language should be preserved');
  assertEqual(normalizeAppLanguage('zh-CN'), defaultAppSettings.language, 'unknown language should fall back');
  assertEqual(normalizeAppLanguage(undefined), defaultAppSettings.language, 'missing language should fall back');
}

function normalizesStorageType() {
  assertEqual(normalizeStorageType('gist'), 'gist', 'gist storage type should be preserved');
  assertEqual(normalizeStorageType('webdav'), 'webdav', 'webdav storage type should be preserved');
  assertEqual(normalizeStorageType('unknown'), 'webdav', 'unknown storage type should fall back to WebDAV');
  assertEqual(normalizeStorageType(undefined), 'webdav', 'missing storage type should fall back to WebDAV');
}

function migratesLegacyGistSettings() {
  const withToken = migrateLegacyGistStorageType({ githubToken: 'token' });
  assertEqual(withToken.storageType, 'gist', 'legacy GitHub token settings should keep Gist storage');

  const withGistId = migrateLegacyGistStorageType({ gistID: 'gist-123' });
  assertEqual(withGistId.storageType, 'gist', 'legacy Gist ID settings should keep Gist storage');

  const explicitWebDav = migrateLegacyGistStorageType({ storageType: 'webdav', gistID: 'gist-123' });
  assertEqual(explicitWebDav.storageType, 'webdav', 'explicit WebDAV storage should not be overwritten');

  const emptyLegacy = migrateLegacyGistStorageType({ githubToken: '', gistID: '   ' });
  assertEqual(emptyLegacy.storageType, undefined, 'empty legacy Gist fields should not force Gist storage');
}

function preservesValidNumericSettings() {
  assertEqual(normalizeSyncIntervalMinutes('30'), 30, 'string sync interval should be converted');
  assertEqual(normalizeSyncIntervalMinutes(15), 15, 'numeric sync interval should be preserved');
  assertEqual(normalizeSafeModeDeleteThreshold('25'), 25, 'string safe-mode threshold should be converted');
  assertEqual(normalizeMaxHistoryRecords('50'), 50, 'string history limit should be converted');
}

function fallsBackForMissingNumericSettings() {
  assertEqual(
    normalizeSyncIntervalMinutes(undefined),
    defaultAppSettings.syncIntervalMinutes,
    'missing sync interval should fall back',
  );
  assertEqual(
    normalizeSafeModeDeleteThreshold(''),
    defaultAppSettings.safeModeDeleteThreshold,
    'empty safe-mode threshold should fall back',
  );
  assertEqual(
    normalizeMaxHistoryRecords(null),
    defaultAppSettings.maxHistoryRecords,
    'null history limit should fall back',
  );
}

function fallsBackForInvalidNumericSettings() {
  assertEqual(
    normalizeSyncIntervalMinutes('not a number'),
    defaultAppSettings.syncIntervalMinutes,
    'invalid sync interval should fall back',
  );
  assertEqual(
    normalizeSafeModeDeleteThreshold(Number.NaN),
    defaultAppSettings.safeModeDeleteThreshold,
    'NaN safe-mode threshold should fall back',
  );
  assertEqual(
    normalizeMaxHistoryRecords(0),
    defaultAppSettings.maxHistoryRecords,
    'zero history limit should fall back',
  );
  assertEqual(
    normalizeMaxHistoryRecords(-10),
    defaultAppSettings.maxHistoryRecords,
    'negative history limit should fall back',
  );
}

function normalizesStringSettings() {
  assertEqual(normalizeStringSetting('value'), 'value', 'string setting should be preserved');
  assertEqual(normalizeStringSetting('', 'fallback'), '', 'empty string setting should be preserved');
  assertEqual(normalizeStringSetting(undefined, 'fallback'), 'fallback', 'missing string setting should fall back');
  assertEqual(normalizeStringSetting(null, 'fallback'), 'fallback', 'null string setting should fall back');
  assertEqual(normalizeStringSetting(123, 'fallback'), 'fallback', 'numeric string setting should fall back');
  assertEqual(normalizeStringSetting(['value'], 'fallback'), 'fallback', 'array string setting should fall back');
  assertEqual(normalizeStringSetting({ value: 'x' }, 'fallback'), 'fallback', 'object string setting should fall back');
}

function normalizesBooleanSettings() {
  assertEqual(normalizeBooleanSetting(true, false), true, 'true boolean setting should be preserved');
  assertEqual(normalizeBooleanSetting(false, true), false, 'false boolean setting should be preserved');
  assertEqual(normalizeBooleanSetting(undefined, true), true, 'missing boolean setting should fall back');
  assertEqual(normalizeBooleanSetting('true', false), false, 'string boolean setting should fall back');
  assertEqual(normalizeBooleanSetting(1, false), false, 'numeric boolean setting should fall back');
  assertEqual(normalizeBooleanSetting(null, true), true, 'null boolean setting should fall back');
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
