// SPDX-License-Identifier: Apache-2.0

export async function requestWebDavHostPermission(webdavUrl: string) {
  const origin = getWebDavOriginPattern(webdavUrl);
  const granted = await browser.permissions.request({
    origins: [origin],
  });

  if (!granted) {
    throw new Error('WebDAV host permission was not granted');
  }

  return origin;
}

export async function assertWebDavHostPermission(webdavUrl: string) {
  const origin = getWebDavOriginPattern(webdavUrl);
  const granted = await browser.permissions.contains({
    origins: [origin],
  });

  if (!granted) {
    throw new Error(`WebDAV host permission is missing. Grant permission for ${origin} in settings.`);
  }
}

export function getWebDavOriginPattern(webdavUrl: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webdavUrl);
  } catch {
    throw new Error('WebDAV URL is invalid');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('WebDAV URL must start with http:// or https://');
  }

  return `${parsedUrl.origin}/*`;
}
