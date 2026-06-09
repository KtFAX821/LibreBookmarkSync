// SPDX-License-Identifier: Apache-2.0

const ENCRYPTION_PASSWORD_KEY = 'encryptionPassword';

export function normalizeLocalEncryptionPassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function getLocalEncryptionPassword() {
  const result = await browser.storage.local.get(ENCRYPTION_PASSWORD_KEY);
  return normalizeLocalEncryptionPassword(result[ENCRYPTION_PASSWORD_KEY]);
}

export async function setLocalEncryptionPassword(password: string) {
  await browser.storage.local.set({
    [ENCRYPTION_PASSWORD_KEY]: password,
  });
}

export async function clearLocalEncryptionPassword() {
  await browser.storage.local.remove(ENCRYPTION_PASSWORD_KEY);
}
