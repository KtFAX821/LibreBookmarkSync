// SPDX-License-Identifier: Apache-2.0

import { AppLanguage, StorageType, defaultAppSettings } from './appSettings';

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return value === 'en' || value === 'zh_CN' || value === 'auto'
    ? value
    : defaultAppSettings.language;
}

export function normalizeStorageType(value: unknown): StorageType {
  return value === 'gist' ? 'gist' : defaultAppSettings.storageType;
}

export function migrateLegacyGistStorageType(savedOptions: Record<string, unknown>) {
  if (savedOptions.storageType === undefined && hasLegacyGistSettings(savedOptions)) {
    savedOptions.storageType = 'gist';
  }

  return savedOptions;
}

export function normalizeSyncIntervalMinutes(value: unknown) {
  return normalizePositiveNumber(value, defaultAppSettings.syncIntervalMinutes);
}

export function normalizeSafeModeDeleteThreshold(value: unknown) {
  return normalizePositiveNumber(value, defaultAppSettings.safeModeDeleteThreshold);
}

export function normalizeMaxHistoryRecords(value: unknown) {
  return normalizePositiveNumber(value, defaultAppSettings.maxHistoryRecords);
}

export function normalizeStringSetting(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeBooleanSetting(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return numberValue;
}

function hasLegacyGistSettings(savedOptions: Record<string, unknown>) {
  return isNonEmptyString(savedOptions.githubToken) || isNonEmptyString(savedOptions.gistID);
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() !== '';
}
