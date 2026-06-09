// SPDX-License-Identifier: Apache-2.0

import { encryptText, decryptText, isEncryptedTextDocument } from '../crypto/encryption';
import { BookmarkInfo, SyncDataInfo } from '../utils/models';

interface SyncDocumentSettings {
  enableEncryption: boolean;
  encryptionPassword: string;
  deviceName: string;
}

interface PlainRemoteDocument {
  schemaVersion: 1;
  app: 'LibreBookmarkSync';
  updatedAt: number;
  deviceName: string;
  browser: string;
  version: string;
  encrypted: false;
  bookmarks: BookmarkInfo[] | undefined;
}

export async function serializeSyncDocument(syncData: SyncDataInfo, setting: SyncDocumentSettings) {
  if (setting.enableEncryption) {
    return JSON.stringify(await encryptText(JSON.stringify(syncData), setting.encryptionPassword));
  }

  const document: PlainRemoteDocument = {
    schemaVersion: 1,
    app: 'LibreBookmarkSync',
    updatedAt: Date.now(),
    deviceName: setting.deviceName,
    browser: syncData.browser,
    version: syncData.version,
    encrypted: false,
    bookmarks: syncData.bookmarks,
  };

  return JSON.stringify(document);
}

export async function parseSyncDocument(content: string, setting: SyncDocumentSettings) {
  const document = JSON.parse(content);
  if (isEncryptedTextDocument(document)) {
    return normalizeLegacySyncData(JSON.parse(await decryptText(document, setting.encryptionPassword)));
  }

  if (isMalformedEncryptedLibreBookmarkSyncDocument(document)) {
    throw new Error('Remote encrypted bookmark file has an unsupported format');
  }

  if (isPlainRemoteDocument(document)) {
    const syncData = new SyncDataInfo();
    syncData.browser = document.browser;
    syncData.version = document.version;
    syncData.createDate = document.updatedAt;
    syncData.bookmarks = normalizeRemoteBookmarks(document.bookmarks);
    return syncData;
  }

  return normalizeLegacySyncData(document);
}

function isPlainRemoteDocument(value: unknown): value is PlainRemoteDocument {
  const document = value as Partial<PlainRemoteDocument>;
  return document?.app === 'LibreBookmarkSync'
    && document.encrypted === false
    && Array.isArray(document.bookmarks);
}

function isMalformedEncryptedLibreBookmarkSyncDocument(value: unknown) {
  const document = value as { app?: unknown; encrypted?: unknown };
  return document?.app === 'LibreBookmarkSync'
    && document.encrypted === true;
}

function normalizeLegacySyncData(value: unknown) {
  const document = value as Partial<SyncDataInfo>;
  if (!Array.isArray(document?.bookmarks)) {
    throw new Error('Remote bookmark file has an unsupported format');
  }

  const syncData = new SyncDataInfo();
  syncData.browser = typeof document.browser === 'string' ? document.browser : syncData.browser;
  syncData.version = typeof document.version === 'string' ? document.version : syncData.version;
  syncData.createDate = typeof document.createDate === 'number' ? document.createDate : syncData.createDate;
  syncData.bookmarks = normalizeRemoteBookmarks(document.bookmarks);
  return syncData;
}

function normalizeRemoteBookmarks(bookmarks: unknown): BookmarkInfo[] {
  if (!Array.isArray(bookmarks)) {
    throw new Error('Remote bookmark file has an unsupported format');
  }

  return bookmarks.map(bookmark => normalizeRemoteBookmark(bookmark));
}

function normalizeRemoteBookmark(value: unknown): BookmarkInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Remote bookmark file contains an invalid bookmark node');
  }

  const bookmark = value as Partial<BookmarkInfo>;
  if (typeof bookmark.title !== 'string') {
    throw new Error('Remote bookmark file contains an invalid bookmark title');
  }

  if (bookmark.url !== undefined && typeof bookmark.url !== 'string') {
    throw new Error('Remote bookmark file contains an invalid bookmark URL');
  }

  if (bookmark.children !== undefined && !Array.isArray(bookmark.children)) {
    throw new Error('Remote bookmark file contains invalid bookmark children');
  }

  if (bookmark.url && bookmark.children && bookmark.children.length > 0) {
    throw new Error('Remote bookmark file contains a bookmark node with children');
  }

  return {
    ...bookmark,
    children: bookmark.children?.map(child => normalizeRemoteBookmark(child)),
  } as BookmarkInfo;
}
