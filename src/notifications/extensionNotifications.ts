// SPDX-License-Identifier: Apache-2.0

import { Setting } from '../utils/setting';

export async function notifySuccess(titleMessageKey: string) {
  const setting = await Setting.build();
  if (!setting.enableNotify) {
    return;
  }

  await browser.notifications.create({
    type: 'basic',
    iconUrl: getNotificationIconUrl(),
    title: browser.i18n.getMessage(titleMessageKey as any),
    message: browser.i18n.getMessage('success'),
  });
}

export async function notifyMessage(titleMessageKey: string, message: string) {
  const setting = await Setting.build();
  if (!setting.enableNotify) {
    return;
  }

  await browser.notifications.create({
    type: 'basic',
    iconUrl: getNotificationIconUrl(),
    title: browser.i18n.getMessage(titleMessageKey as any),
    message,
  });
}

export async function notifyError(titleMessageKey: string, error: unknown) {
  await browser.notifications.create({
    type: 'basic',
    iconUrl: getNotificationIconUrl(),
    title: browser.i18n.getMessage(titleMessageKey as any),
    message: `${browser.i18n.getMessage('error')}: ${getErrorMessage(error)}`,
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getNotificationIconUrl() {
  return browser.runtime.getURL('/icons/128.png');
}
