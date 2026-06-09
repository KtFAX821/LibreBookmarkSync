// SPDX-License-Identifier: Apache-2.0

export type StorageType = 'gist' | 'webdav';
export type AppLanguage = 'auto' | 'en' | 'zh_CN';

export interface AppSettings {
  language: AppLanguage;
  deviceName: string;
  storageType: StorageType;
  enableEncryption: boolean;
  enableAutoSync: boolean;
  syncIntervalMinutes: number;
  enableSafeMode: boolean;
  safeModeDeleteThreshold: number;
  maxHistoryRecords: number;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavPath: string;
}

export const defaultAppSettings: AppSettings = {
  language: 'auto',
  deviceName: '',
  storageType: 'webdav',
  enableEncryption: false,
  enableAutoSync: false,
  syncIntervalMinutes: 10,
  enableSafeMode: true,
  safeModeDeleteThreshold: 20,
  maxHistoryRecords: 100,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/libre-bookmark-sync.json',
};
