// SPDX-License-Identifier: Apache-2.0

interface BadgeTextDetails {
  text: string;
}

interface BadgeBackgroundColorDetails {
  color: string;
}

interface ExtensionActionApi {
  setBadgeText(details: BadgeTextDetails): Promise<void>;
  setBadgeBackgroundColor(details: BadgeBackgroundColorDetails): Promise<void>;
}

export async function setExtensionBadgeText(text: string) {
  const extensionAction = getExtensionAction();
  if (!extensionAction) {
    return;
  }

  await extensionAction.setBadgeText({ text });
}

export async function setExtensionBadgeBackgroundColor(color: string) {
  const extensionAction = getExtensionAction();
  if (!extensionAction) {
    return;
  }

  await extensionAction.setBadgeBackgroundColor({ color });
}

function getExtensionAction() {
  const extensionBrowser = browser as typeof browser & {
    browserAction?: ExtensionActionApi;
  };

  return extensionBrowser.action || extensionBrowser.browserAction;
}
