// SPDX-License-Identifier: Apache-2.0

import { GistAdapter } from '../src/storage/gistAdapter';

type HttpCall = {
  method: 'get' | 'patch';
  url: string;
  options?: unknown;
};

const calls: HttpCall[] = [];
const permissionChecks: string[][] = [];
let jsonResponses: unknown[] = [];
let textResponses: string[] = [];
let permissionGranted = true;

installBrowserMocks();

runTests();

async function runTests() {
  await testUsesConfiguredGistId();
  await downloadReturnsNullWhenGistHasNoFiles();
  await downloadReturnsNullWhenConfiguredFileIsMissing();
  await downloadReturnsInlineFileContent();
  await downloadFetchesRawContentForTruncatedFiles();
  await uploadPatchesConfiguredFileAndDescription();
  await operationsRequireGistHostPermission();
  await operationsRequireCompleteSettings();
  console.log('gistAdapter tests passed');
}

async function testUsesConfiguredGistId() {
  resetMocks();
  jsonResponses = [{ files: {} }];

  await adapter().test();

  assertEqual(calls.length, 1, 'test should make one request');
  assertEqual(calls[0].method, 'get', 'test should use GET');
  assertEqual(calls[0].url, 'gists/gist-123', 'test should request the configured Gist ID');
  assertEqual(permissionChecks[0].join(','), 'https://api.github.com/*,https://gist.githubusercontent.com/*', 'test should check the Gist optional host permissions');
}

async function downloadReturnsNullWhenGistHasNoFiles() {
  resetMocks();
  jsonResponses = [{}];

  const content = await adapter().download();

  assertEqual(content, null, 'download should return null when the Gist has no files');
}

async function downloadReturnsNullWhenConfiguredFileIsMissing() {
  resetMocks();
  jsonResponses = [{
    files: {
      'other.json': {
        content: 'other content',
      },
    },
  }];

  const content = await adapter().download();

  assertEqual(content, null, 'download should return null when the configured file is missing');
}

async function downloadReturnsInlineFileContent() {
  resetMocks();
  jsonResponses = [{
    files: {
      'libre-bookmark-sync.json': {
        content: '{"bookmarks":[]}',
      },
    },
  }];

  const content = await adapter().download();

  assertEqual(content, '{"bookmarks":[]}', 'download should return inline file content');
  assertEqual(calls.length, 1, 'inline download should not fetch raw_url');
}

async function downloadFetchesRawContentForTruncatedFiles() {
  resetMocks();
  jsonResponses = [{
    files: {
      'libre-bookmark-sync.json': {
        truncated: true,
        raw_url: 'https://gist.githubusercontent.com/raw-file',
      },
    },
  }];
  textResponses = ['raw remote content'];

  const content = await adapter().download();

  assertEqual(content, 'raw remote content', 'truncated download should return raw file content');
  assertEqual(calls.length, 2, 'truncated download should make a second raw request');
  assertEqual(calls[1].url, 'https://gist.githubusercontent.com/raw-file', 'truncated download should use raw_url');
  assertEqual((calls[1].options as { prefixUrl?: string }).prefixUrl, '', 'truncated raw request should bypass the GitHub API prefix');
}

async function uploadPatchesConfiguredFileAndDescription() {
  resetMocks();
  jsonResponses = [{}];

  await adapter().upload('sync document', 'manual upload');

  const options = calls[0].options as {
    json: {
      description: string;
      files: Record<string, { content: string }>;
    };
  };

  assertEqual(calls[0].method, 'patch', 'upload should use PATCH');
  assertEqual(calls[0].url, 'gists/gist-123', 'upload should patch the configured Gist');
  assertEqual(options.json.description, 'manual upload', 'upload should set the Gist description');
  assertEqual(options.json.files['libre-bookmark-sync.json'].content, 'sync document', 'upload should write the configured file content');
}

async function operationsRequireCompleteSettings() {
  for (const [field, message] of [
    ['githubToken', 'missing token should reject'],
    ['gistID', 'missing Gist ID should reject'],
    ['gistFileName', 'missing Gist file should reject'],
  ] as const) {
    resetMocks();
    const partialSetting = {
      ...setting(),
      [field]: '',
    };

    await assertRejects(
      () => new GistAdapter(partialSetting as never, client()).download(),
      message,
    );

    assertEqual(calls.length, 0, `${message} before making HTTP requests`);
    assertEqual(permissionChecks.length, 0, `${message} before checking host permissions`);
  }
}

async function operationsRequireGistHostPermission() {
  resetMocks();
  permissionGranted = false;
  jsonResponses = [{}];

  await assertRejects(
    () => adapter().download(),
    'download should fail before HTTP when GitHub Gist host permission is missing',
  );

  assertEqual(calls.length, 0, 'download should not make HTTP requests without Gist host permission');
  assertEqual(permissionChecks.length, 1, 'download should check Gist host permission');
}

function adapter() {
  return new GistAdapter(setting() as never, client());
}

function setting() {
  return {
    githubToken: 'token',
    gistID: 'gist-123',
    gistFileName: 'libre-bookmark-sync.json',
  };
}

function client() {
  return {
    get: (url: string, options?: unknown) => {
      calls.push({ method: 'get', url, options });
      return {
        json: async () => {
          if (jsonResponses.length === 0) {
            throw new Error('Unexpected JSON response request');
          }
          return jsonResponses.shift();
        },
        text: async () => {
          if (textResponses.length === 0) {
            throw new Error('Unexpected text response request');
          }
          return textResponses.shift() || '';
        },
      };
    },
    patch: (url: string, options: unknown) => {
      calls.push({ method: 'patch', url, options });
      return {
        json: async () => {
          if (jsonResponses.length === 0) {
            throw new Error('Unexpected JSON response request');
          }
          return jsonResponses.shift();
        },
      };
    },
  };
}

function resetMocks() {
  calls.length = 0;
  permissionChecks.length = 0;
  jsonResponses = [];
  textResponses = [];
  permissionGranted = true;
}

function installBrowserMocks() {
  (globalThis as never as { browser: unknown }).browser = {
    permissions: {
      contains: async ({ origins }: { origins: string[] }) => {
        permissionChecks.push(origins);
        return permissionGranted;
      },
    },
  };
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
