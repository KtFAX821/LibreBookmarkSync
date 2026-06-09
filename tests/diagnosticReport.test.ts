// SPDX-License-Identifier: Apache-2.0

import {
  DiagnosticReportSnapshot,
  formatDiagnosticReport,
} from '../src/diagnostics/diagnosticReport';
import { RootBookmarksType } from '../src/utils/models';

runTests();

function runTests() {
  formatsUsefulDiagnosticStatus();
  omitsSensitiveStorageAndBookmarkDetails();
  console.log('diagnosticReport tests passed');
}

function formatsUsefulDiagnosticStatus() {
  const report = formatDiagnosticReport(snapshot());

  assertIncludes(report, 'LibreBookmarkSync Diagnostic Report', 'report should include a title');
  assertIncludes(report, 'Extension Version: 0.1.0-local', 'report should include extension version');
  assertIncludes(report, '- Storage Type: webdav', 'report should include storage backend');
  assertIncludes(report, '- Live Syncable Local Count: 12', 'report should include live syncable bookmark count');
  assertIncludes(report, '- Raw Browser URL Count: 15', 'report should include raw browser bookmark count');
  assertIncludes(report, '- Skipped Local Count: 3', 'report should include skipped bookmark count');
  assertIncludes(report, '- Raw URL Scheme Counts: total 15, web 13, browser-internal 1, other 1', 'report should include raw URL scheme counts');
  assertIncludes(report, '- Syncable URL Scheme Counts: total 12, web 11, browser-internal 1, other 0', 'report should include syncable URL scheme counts');
  assertIncludes(report, '0: ToolbarFolder | raw 10 | syncable 10', 'report should include root summary');
  assertIncludes(report, 'raw schemes total 10, web 9, browser-internal 1, other 0', 'report should include root scheme summary');
  assertIncludes(report, '- Permission Origin: https://dav.example.test/*', 'report should include WebDAV permission origin');
  assertIncludes(report, '- Permission Status: missing', 'report should include WebDAV permission status');
  assertIncludes(report, 'upload | failure | webdav', 'report should include recent operation status');
  assertIncludes(report, 'WebDAV upload failed: 403 Forbidden', 'report should include useful failure detail');
  assertIncludes(report, 'message omitted to avoid exposing bookmark or credential details', 'report should omit unknown history detail');
  assertIncludes(report, 'Safety Warning: blocked at', 'report should include pending safety state');
  assertIncludes(report, 'Conflict Warning: blocked at', 'report should include pending conflict state');
}

function omitsSensitiveStorageAndBookmarkDetails() {
  const report = formatDiagnosticReport(snapshot());
  const forbidden = [
    'super-secret-token',
    'webdav-password',
    'gist-secret-id',
    '/private/bookmarks/libre-bookmark-sync.json',
    'https://private.example.test/bookmark',
    'Private Bookmark Title',
    'Authorization: Bearer',
  ];

  for (const value of forbidden) {
    assert(
      !report.includes(value),
      `report should not include sensitive value: ${value}`,
    );
  }

  assertIncludes(report, 'Token Configured: yes', 'report may include token configured boolean');
  assertIncludes(report, 'Password Configured: yes', 'report may include password configured boolean');
  assertIncludes(report, 'Gist ID Configured: yes', 'report may include Gist ID configured boolean');
  assertIncludes(report, 'File Path Configured: yes', 'report may include WebDAV file path configured boolean');
  assertIncludes(report, 'Sensitive Data Policy', 'report should explain the sensitive data policy');
}

function snapshot(): DiagnosticReportSnapshot {
  return {
    generatedAt: Date.UTC(2026, 5, 8, 10, 30, 0),
    extensionVersion: '0.1.0-local',
    userAgent: 'Chrome test agent',
    language: 'zh_CN',
    storageType: 'webdav',
    deviceNameConfigured: true,
    enableNotifications: true,
    enableEncryption: true,
    encryptionPasswordConfigured: true,
    enableAutoSync: false,
    syncIntervalMinutes: 10,
    enableSafeMode: true,
    safeModeDeleteThreshold: 20,
    localBookmarkCount: 12,
    rawLocalBookmarkCount: 15,
    skippedLocalBookmarkCount: 3,
    localUrlSchemeCounts: {
      total: 15,
      web: 13,
      browserInternal: 1,
      other: 1,
    },
    syncableUrlSchemeCounts: {
      total: 12,
      web: 11,
      browserInternal: 1,
      other: 0,
    },
    localBookmarkRoots: [
      {
        rootIndex: 0,
        rootType: RootBookmarksType.ToolbarFolder,
        bookmarkCount: 10,
        syncableBookmarkCount: 10,
        urlSchemeCounts: {
          total: 10,
          web: 9,
          browserInternal: 1,
          other: 0,
        },
        syncableUrlSchemeCounts: {
          total: 10,
          web: 9,
          browserInternal: 1,
          other: 0,
        },
        syncable: true,
      },
      {
        rootIndex: 1,
        rootType: RootBookmarksType.MobileFolder,
        bookmarkCount: 3,
        syncableBookmarkCount: 0,
        urlSchemeCounts: {
          total: 3,
          web: 2,
          browserInternal: 0,
          other: 1,
        },
        syncableUrlSchemeCounts: {
          total: 0,
          web: 0,
          browserInternal: 0,
          other: 0,
        },
        syncable: false,
      },
      {
        rootIndex: 2,
        rootType: RootBookmarksType.UnfiledFolder,
        bookmarkCount: 2,
        syncableBookmarkCount: 2,
        urlSchemeCounts: {
          total: 2,
          web: 2,
          browserInternal: 0,
          other: 0,
        },
        syncableUrlSchemeCounts: {
          total: 2,
          web: 2,
          browserInternal: 0,
          other: 0,
        },
        syncable: true,
      },
    ],
    cachedLocalCount: 11,
    cachedRemoteCount: 20,
    webDav: {
      configured: true,
      urlConfigured: true,
      usernameConfigured: true,
      passwordConfigured: true,
      pathConfigured: true,
      permissionOrigin: 'https://dav.example.test/*',
      permissionStatus: 'missing',
    },
    gist: {
      configured: true,
      tokenConfigured: true,
      gistIdConfigured: true,
      fileNameConfigured: true,
      permissionOrigins: ['https://api.github.com/*', 'https://gist.githubusercontent.com/*'],
      permissionStatus: 'granted',
    },
    pendingSafety: {
      blockedAt: Date.UTC(2026, 5, 8, 10, 20, 0),
      localCount: 12,
      previousRemoteCount: 20,
      deletedCount: 8,
      deletedPercent: 40,
      threshold: 20,
    },
    pendingConflict: {
      blockedAt: Date.UTC(2026, 5, 8, 10, 25, 0),
      message: 'Remote changed while local changed',
      localChanged: true,
    },
    recentHistory: [
      {
        timestamp: Date.UTC(2026, 5, 8, 10, 10, 0),
        operation: 'upload',
        status: 'failure',
        storageType: 'webdav',
        bookmarkCount: 12,
        message: 'WebDAV upload failed: 403 Forbidden Authorization: Bearer super-secret-token password=webdav-password',
      },
      {
        timestamp: Date.UTC(2026, 5, 8, 10, 0, 0),
        operation: 'download',
        status: 'success',
        storageType: 'gist',
        bookmarkCount: 12,
        message: 'Downloaded Private Bookmark Title from https://private.example.test/bookmark using gist-secret-id and /private/bookmarks/libre-bookmark-sync.json',
      },
    ],
  };
}

function assertIncludes(value: string, expected: string, message: string) {
  assert(value.includes(expected), `${message}. Missing: ${expected}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}
