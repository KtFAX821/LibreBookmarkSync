// SPDX-License-Identifier: Apache-2.0

const gistHostOrigins = [
  'https://api.github.com/*',
  'https://gist.githubusercontent.com/*',
];

export async function requestGistHostPermissions() {
  const granted = await browser.permissions.request({
    origins: gistHostOrigins,
  });

  if (!granted) {
    throw new Error('GitHub Gist host permission was not granted');
  }

  return gistHostOrigins;
}

export async function assertGistHostPermissions() {
  const granted = await browser.permissions.contains({
    origins: gistHostOrigins,
  });

  if (!granted) {
    throw new Error('GitHub Gist host permission is missing. Grant GitHub Gist permission in settings.');
  }
}

export function getGistHostPermissionOrigins() {
  return [...gistHostOrigins];
}
