// SPDX-License-Identifier: Apache-2.0

import { StorageAdapter } from './storageAdapter';
import { GistAdapter } from './gistAdapter';
import { WebDavAdapter } from './webdavAdapter';
import type { Setting } from '../utils/setting';

type StorageAdapterSetting = Setting | {
  storageType: string;
};

export function createStorageAdapter(setting: StorageAdapterSetting): StorageAdapter {
  switch (setting.storageType) {
    case 'gist':
      return new GistAdapter(setting as Setting);
    case 'webdav':
      return new WebDavAdapter(setting as Setting);
    default:
      throw new Error(`Unsupported storage type: ${setting.storageType}`);
  }
}
