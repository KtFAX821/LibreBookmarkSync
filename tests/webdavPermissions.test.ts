// SPDX-License-Identifier: Apache-2.0

import { getWebDavOriginPattern } from '../src/storage/webdavPermissions';

runTests();

function runTests() {
  keepsOnlyTheOriginForWebDavUrls();
  keepsExplicitPortsInThePermissionOrigin();
  stripsCredentialsFromThePermissionOrigin();
  allowsPlainHttpForSelfHostedTestEndpoints();
  rejectsUnsupportedSchemes();
  rejectsMalformedUrls();
  console.log('webdavPermissions tests passed');
}

function keepsOnlyTheOriginForWebDavUrls() {
  assertEqual(
    getWebDavOriginPattern('https://cloud.example.com/remote.php/dav/files/user/libre-bookmark-sync.json'),
    'https://cloud.example.com/*',
    'WebDAV permission should request only the origin, not the full file path',
  );
}

function keepsExplicitPortsInThePermissionOrigin() {
  assertEqual(
    getWebDavOriginPattern('https://nas.example.test:8443/dav/bookmarks.json'),
    'https://nas.example.test:8443/*',
    'WebDAV permission should include explicit non-default ports',
  );
}

function stripsCredentialsFromThePermissionOrigin() {
  assertEqual(
    getWebDavOriginPattern('https://user:password@webdav.example.test/private/bookmarks.json'),
    'https://webdav.example.test/*',
    'WebDAV permission should never include URL credentials',
  );
}

function allowsPlainHttpForSelfHostedTestEndpoints() {
  assertEqual(
    getWebDavOriginPattern('http://localhost:8080/dav/libre-bookmark-sync.json'),
    'http://localhost:8080/*',
    'WebDAV permission should support local HTTP endpoints',
  );
}

function rejectsUnsupportedSchemes() {
  assertThrows(
    () => getWebDavOriginPattern('ftp://example.com/bookmarks.json'),
    'unsupported WebDAV URL schemes should be rejected',
  );
}

function rejectsMalformedUrls() {
  assertThrows(
    () => getWebDavOriginPattern('not a url'),
    'malformed WebDAV URLs should be rejected',
  );
}

function assertThrows(handler: () => unknown, message: string) {
  try {
    handler();
  } catch {
    return;
  }

  throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
