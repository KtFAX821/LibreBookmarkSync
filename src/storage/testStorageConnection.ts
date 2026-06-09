// SPDX-License-Identifier: Apache-2.0

import type { StorageAdapter } from './storageAdapter';
import { createStorageAdapter } from './storageFactory';
import type { Setting } from '../utils/setting';

type StorageConnectionSetting = Setting | {
  storageType: string;
};

type StorageAdapterFactory = (setting: StorageConnectionSetting) => StorageAdapter;

export async function testStorageConnection(
  setting: StorageConnectionSetting,
  createAdapter: StorageAdapterFactory = createStorageAdapter,
) {
  const storage = createAdapter(setting);
  await storage.test();
  return `${storage.type} connection test successful`;
}
