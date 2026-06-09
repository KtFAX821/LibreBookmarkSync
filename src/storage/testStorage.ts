// SPDX-License-Identifier: Apache-2.0

import { Setting } from '../utils/setting';
import { testStorageConnection } from './testStorageConnection';

export async function testCurrentStorageConnection() {
  const setting = await Setting.build();
  return testStorageConnection(setting);
}
