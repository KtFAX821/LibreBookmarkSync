// SPDX-License-Identifier: Apache-2.0

import { parseSyncDocument, serializeSyncDocument } from '../src/sync/syncDocument';
import { SyncDataInfo } from '../src/utils/models';

runTests();

async function runTests() {
  await parsesPlainLibreBookmarkSyncDocument();
  await parsesLegacySyncDataDocument();
  await rejectsMalformedJson();
  await rejectsUnsupportedDocumentShape();
  await rejectsNonArrayBookmarks();
  await rejectsMalformedBookmarkNodes();
  await serializesPlainLibreBookmarkSyncDocument();
  await roundTripsEncryptedSyncDocument();
  await rejectsEncryptedSyncDocumentWithWrongPassword();
  await rejectsEncryptedSyncDocumentWithMissingMetadata();
  await rejectsMalformedEncryptedDocumentEvenIfItHasBookmarks();
  console.log('syncDocument tests passed');
}

async function parsesPlainLibreBookmarkSyncDocument() {
  const document = {
    schemaVersion: 1,
    app: 'LibreBookmarkSync',
    updatedAt: 12345,
    deviceName: 'test-device',
    browser: 'test-browser',
    version: '0.1.0',
    encrypted: false,
    bookmarks: [
      bookmark('Plain', 'https://example.com/plain'),
    ],
  };

  const result = await parseSyncDocument(JSON.stringify(document), setting());

  assertEqual(result.browser, 'test-browser', 'plain document browser should be preserved');
  assertEqual(result.version, '0.1.0', 'plain document version should be preserved');
  assertEqual(result.createDate, 12345, 'plain document updatedAt should map to createDate');
  assertEqual(result.bookmarks?.[0]?.title, 'Plain', 'plain document bookmarks should be preserved');
}

async function parsesLegacySyncDataDocument() {
  const document = {
    browser: 'legacy-browser',
    version: '0.0.9',
    createDate: 67890,
    bookmarks: [
      bookmark('Legacy', 'https://example.com/legacy'),
    ],
  };

  const result = await parseSyncDocument(JSON.stringify(document), setting());

  assertEqual(result.browser, 'legacy-browser', 'legacy browser should be preserved');
  assertEqual(result.version, '0.0.9', 'legacy version should be preserved');
  assertEqual(result.createDate, 67890, 'legacy createDate should be preserved');
  assertEqual(result.bookmarks?.[0]?.title, 'Legacy', 'legacy bookmarks should be preserved');
}

async function rejectsMalformedJson() {
  await assertRejects(
    () => parseSyncDocument('{not-json', setting()),
    'malformed JSON should be rejected',
  );
}

async function rejectsUnsupportedDocumentShape() {
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ app: 'SomethingElse', items: [] }), setting()),
    'unsupported document should be rejected',
  );
}

async function rejectsNonArrayBookmarks() {
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ bookmarks: {} }), setting()),
    'non-array bookmarks should be rejected',
  );
}

async function rejectsMalformedBookmarkNodes() {
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ bookmarks: [null] }), setting()),
    'null bookmark node should be rejected',
  );
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ bookmarks: [{ url: 'https://example.com/missing-title' }] }), setting()),
    'bookmark node without title should be rejected',
  );
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ bookmarks: [{ title: 'Bad URL', url: 123 }] }), setting()),
    'bookmark node with non-string URL should be rejected',
  );
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({ bookmarks: [{ title: 'Bad Children', children: {} }] }), setting()),
    'bookmark node with non-array children should be rejected',
  );
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({
      schemaVersion: 1,
      app: 'LibreBookmarkSync',
      updatedAt: 12345,
      deviceName: 'test-device',
      browser: 'test-browser',
      version: '0.1.0',
      encrypted: false,
      bookmarks: [
        {
          title: 'Bookmark With Children',
          url: 'https://example.com/with-children',
          children: [
            bookmark('Nested', 'https://example.com/nested'),
          ],
        },
      ],
    }), setting()),
    'URL bookmark node with children should be rejected',
  );
}

async function serializesPlainLibreBookmarkSyncDocument() {
  const syncData = new SyncDataInfo();
  syncData.browser = 'serialize-browser';
  syncData.version = '0.1.0';
  syncData.bookmarks = [
    bookmark('Serialized', 'https://example.com/serialized'),
  ];

  const content = await serializeSyncDocument(syncData, setting());
  const document = JSON.parse(content);

  assertEqual(document.app, 'LibreBookmarkSync', 'serialized document should use LibreBookmarkSync app marker');
  assertEqual(document.encrypted, false, 'serialized document should be plain when encryption is disabled');
  assertEqual(document.bookmarks[0].title, 'Serialized', 'serialized bookmarks should be included');
}

async function roundTripsEncryptedSyncDocument() {
  const syncData = new SyncDataInfo();
  syncData.browser = 'encrypted-browser';
  syncData.version = '0.1.0';
  syncData.bookmarks = [
    bookmark('Encrypted Secret', 'https://example.com/encrypted-secret'),
  ];

  const content = await serializeSyncDocument(syncData, setting({
    enableEncryption: true,
    encryptionPassword: 'correct-password',
  }));
  const document = JSON.parse(content);

  assertEqual(document.app, 'LibreBookmarkSync', 'encrypted document should use LibreBookmarkSync app marker');
  assertEqual(document.encrypted, true, 'encrypted document should be marked encrypted');
  assertEqual(typeof document.payload, 'string', 'encrypted document should include encrypted payload');
  assertNotIncludes(content, 'Encrypted Secret', 'encrypted document should not expose bookmark title');
  assertNotIncludes(content, 'https://example.com/encrypted-secret', 'encrypted document should not expose bookmark URL');

  const parsed = await parseSyncDocument(content, setting({
    enableEncryption: true,
    encryptionPassword: 'correct-password',
  }));

  assertEqual(parsed.browser, 'encrypted-browser', 'encrypted browser should round-trip');
  assertEqual(parsed.bookmarks?.[0]?.title, 'Encrypted Secret', 'encrypted bookmark title should round-trip');
  assertEqual(parsed.bookmarks?.[0]?.url, 'https://example.com/encrypted-secret', 'encrypted bookmark URL should round-trip');
}

async function rejectsEncryptedSyncDocumentWithWrongPassword() {
  const syncData = new SyncDataInfo();
  syncData.bookmarks = [
    bookmark('Wrong Password', 'https://example.com/wrong-password'),
  ];

  const content = await serializeSyncDocument(syncData, setting({
    enableEncryption: true,
    encryptionPassword: 'correct-password',
  }));

  await assertRejects(
    () => parseSyncDocument(content, setting({
      enableEncryption: true,
      encryptionPassword: 'wrong-password',
    })),
    'encrypted document should reject wrong password',
  );
}

async function rejectsEncryptedSyncDocumentWithMissingMetadata() {
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({
      schemaVersion: 1,
      app: 'LibreBookmarkSync',
      updatedAt: 12345,
      encrypted: true,
      encryption: {
        algorithm: 'AES-GCM',
      },
      payload: 'not-enough-metadata',
    }), setting({
      encryptionPassword: 'correct-password',
    })),
    'encrypted document with missing metadata should be rejected',
  );
}

async function rejectsMalformedEncryptedDocumentEvenIfItHasBookmarks() {
  await assertRejects(
    () => parseSyncDocument(JSON.stringify({
      app: 'LibreBookmarkSync',
      encrypted: true,
      bookmarks: [
        bookmark('Should Not Parse', 'https://example.com/should-not-parse'),
      ],
    }), setting()),
    'malformed encrypted document should not fall back to legacy bookmark parsing',
  );
}

function setting(overrides: Partial<ReturnType<typeof baseSetting>> = {}) {
  return {
    ...baseSetting(),
    ...overrides,
  } as never;
}

function baseSetting() {
  return {
    enableEncryption: false,
    encryptionPassword: '',
    deviceName: 'test-device',
  };
}

function bookmark(title: string, url: string) {
  return {
    title,
    url,
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

function assertNotIncludes(value: string, unexpected: string, message: string) {
  if (value.includes(unexpected)) {
    throw new Error(`${message}. Found ${unexpected}`);
  }
}
