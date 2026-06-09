// SPDX-License-Identifier: Apache-2.0

import { Setting } from '../utils/setting';
import { defaultAppSettings } from '../settings/appSettings';

export type SyncOperationType = 'upload' | 'download' | 'removeAll' | 'auto' | 'forcePush' | 'forcePull' | 'restore';
export type SyncOperationStatus = 'success' | 'failure';

export interface SyncHistoryRecord {
  id: string;
  timestamp: number;
  operation: SyncOperationType;
  status: SyncOperationStatus;
  storageType: string;
  deviceName: string;
  message: string;
  bookmarkCount?: number;
}

const HISTORY_KEY = 'syncHistoryRecords';
const OPERATION_TYPES: SyncOperationType[] = ['upload', 'download', 'removeAll', 'auto', 'forcePush', 'forcePull', 'restore'];
const OPERATION_STATUSES: SyncOperationStatus[] = ['success', 'failure'];

export async function addSyncHistoryRecord(
  record: Omit<SyncHistoryRecord, 'id' | 'timestamp' | 'storageType' | 'deviceName'>,
) {
  const setting = await Setting.build();
  const existing = await getSyncHistoryRecords();
  const nextRecord: SyncHistoryRecord = {
    id: createRecordId(),
    timestamp: Date.now(),
    storageType: setting.storageType,
    deviceName: setting.deviceName || getFallbackDeviceName(),
    ...record,
  };

  const maxRecords = setting.maxHistoryRecords || 100;
  await browser.storage.local.set({
    [HISTORY_KEY]: [nextRecord, ...existing].slice(0, maxRecords),
  });
}

export async function getSyncHistoryRecords() {
  const setting = await Setting.build();
  const result = await browser.storage.local.get(HISTORY_KEY);
  return normalizeSyncHistoryRecords(result[HISTORY_KEY], setting.maxHistoryRecords);
}

export async function clearSyncHistoryRecords() {
  await browser.storage.local.set({
    [HISTORY_KEY]: [],
  });
}

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFallbackDeviceName() {
  return navigator.userAgent || 'Unknown Device';
}

export function normalizeSyncHistoryRecords(rawRecords: unknown, maxRecords = defaultAppSettings.maxHistoryRecords) {
  if (!Array.isArray(rawRecords)) {
    return [];
  }

  return rawRecords
    .filter(isSyncHistoryRecord)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, normalizeMaxRecords(maxRecords));
}

function isSyncHistoryRecord(record: unknown): record is SyncHistoryRecord {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const candidate = record as Partial<SyncHistoryRecord>;
  return (
    isNonEmptyString(candidate.id)
    && Number.isFinite(candidate.timestamp)
    && OPERATION_TYPES.includes(candidate.operation as SyncOperationType)
    && OPERATION_STATUSES.includes(candidate.status as SyncOperationStatus)
    && isNonEmptyString(candidate.storageType)
    && isNonEmptyString(candidate.deviceName)
    && typeof candidate.message === 'string'
    && (
      candidate.bookmarkCount === undefined
      || Number.isFinite(candidate.bookmarkCount)
    )
  );
}

function normalizeMaxRecords(maxRecords: number) {
  if (!Number.isFinite(maxRecords) || maxRecords < 1) {
    return defaultAppSettings.maxHistoryRecords;
  }

  return Math.floor(maxRecords);
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}
