// SPDX-License-Identifier: Apache-2.0

import { WebDavAdapter } from '../src/storage/webdavAdapter';

type FetchCall = {
  url: string;
  init: RequestInit;
};

const fetchCalls: FetchCall[] = [];
const permissionChecks: string[] = [];
let fetchResponses: Array<ReturnType<typeof response>> = [];
let permissionGranted = true;

installBrowserMocks();

runTests();

async function runTests() {
  await testUsesHeadAndAllowsMissingRemoteFile();
  await downloadReturnsRemoteFileContent();
  await downloadReturnsNullForMissingRemoteFile();
  await uploadWritesJsonToTheConfiguredWebDavPath();
  await stripsCredentialsFromWebDavRequestUrl();
  await operationsRequireWebDavHostPermission();
  await testReportsHttpFailures();
  console.log('webdavAdapter tests passed');
}

async function testUsesHeadAndAllowsMissingRemoteFile() {
  resetMocks();
  fetchResponses = [response(404, 'Not Found')];

  await adapter().test();

  assertEqual(fetchCalls.length, 1, 'test should make one request');
  assertEqual(fetchCalls[0].url, 'https://dav.example.test/remote.php/dav/files/user/libre-bookmark-sync.json', 'test should use the joined WebDAV file URL');
  assertEqual(fetchCalls[0].init.method, 'HEAD', 'test should use HEAD');
  assertEqual(permissionChecks[0], 'https://dav.example.test/*', 'test should check host permission for the WebDAV origin');
  assertEqual(getHeader(fetchCalls[0].init.headers, 'Authorization'), 'Basic dXNlcjpwYXNz', 'test should send basic auth');
}

async function downloadReturnsRemoteFileContent() {
  resetMocks();
  fetchResponses = [response(200, 'OK', 'remote content')];

  const content = await adapter().download();

  assertEqual(content, 'remote content', 'download should return remote text content');
  assertEqual(fetchCalls[0].init.method, 'GET', 'download should use GET');
}

async function downloadReturnsNullForMissingRemoteFile() {
  resetMocks();
  fetchResponses = [response(404, 'Not Found')];

  const content = await adapter().download();

  assertEqual(content, null, 'download should return null when the remote file is missing');
}

async function uploadWritesJsonToTheConfiguredWebDavPath() {
  resetMocks();
  fetchResponses = [response(201, 'Created')];

  await adapter().upload('{"bookmarks":[]}', 'ignored for WebDAV');

  assertEqual(fetchCalls[0].init.method, 'PUT', 'upload should use PUT');
  assertEqual(fetchCalls[0].init.body, '{"bookmarks":[]}', 'upload should send the sync document body');
  assertEqual(getHeader(fetchCalls[0].init.headers, 'Content-Type'), 'application/json;charset=utf-8', 'upload should mark JSON content');
}

async function stripsCredentialsFromWebDavRequestUrl() {
  resetMocks();
  fetchResponses = [response(200, 'OK', 'remote content')];

  await adapter({
    webdavUrl: 'https://url-user:url-pass@dav.example.test/remote.php/dav/files/user?ignored=true#ignored',
  }).download();

  assertEqual(
    fetchCalls[0].url,
    'https://dav.example.test/remote.php/dav/files/user/libre-bookmark-sync.json',
    'WebDAV request URL should not include URL credentials, query, or fragment',
  );
  assertEqual(permissionChecks[0], 'https://dav.example.test/*', 'permission check should still use credential-free origin');
}

async function operationsRequireWebDavHostPermission() {
  resetMocks();
  permissionGranted = false;
  fetchResponses = [response(200, 'OK')];

  await assertRejects(
    () => adapter().download(),
    'download should fail before fetch when WebDAV host permission is missing',
  );

  assertEqual(fetchCalls.length, 0, 'download should not fetch without host permission');
}

async function testReportsHttpFailures() {
  resetMocks();
  fetchResponses = [response(503, 'Service Unavailable')];

  await assertRejects(
    () => adapter().test(),
    'test should reject non-404 HTTP failures',
  );
}

function adapter(overrides: Record<string, unknown> = {}) {
  return new WebDavAdapter({
    webdavUrl: 'https://dav.example.test/remote.php/dav/files/user',
    webdavUsername: 'user',
    webdavPassword: 'pass',
    webdavPath: '/libre-bookmark-sync.json',
    ...overrides,
  } as never);
}

function installBrowserMocks() {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const next = fetchResponses.shift();
    if (!next) {
      throw new Error('Unexpected fetch call');
    }

    fetchCalls.push({
      url: String(url),
      init: init || {},
    });
    return next as never;
  }) as never;

  (globalThis as never as { browser: unknown }).browser = {
    permissions: {
      contains: async ({ origins }: { origins: string[] }) => {
        permissionChecks.push(origins[0]);
        return permissionGranted;
      },
    },
  };
}

function resetMocks() {
  fetchCalls.length = 0;
  permissionChecks.length = 0;
  fetchResponses = [];
  permissionGranted = true;
}

function response(status: number, statusText: string, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  };
}

function getHeader(headers: HeadersInit | undefined, name: string) {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(name) || undefined;
  }

  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  }

  return headers[name];
}

async function assertRejects(handler: () => Promise<unknown>, message: string) {
  try {
    await handler();
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
