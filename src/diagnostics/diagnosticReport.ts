// SPDX-License-Identifier: Apache-2.0

import {
  BookmarkRootSummary,
  BookmarkUrlSchemeCounts,
  countSyncableBookmarks,
  getBookmarkTree,
  summarizeBookmarkCounts,
} from '../bookmarks/bookmarkTree';
import { getSyncHistoryRecords, SyncHistoryRecord } from '../history/syncHistory';
import { getGistHostPermissionOrigins } from '../storage/gistPermissions';
import { getWebDavOriginPattern } from '../storage/webdavPermissions';
import { getPendingAutoSyncConflict } from '../sync/autoSyncConflict';
import { getPendingAutoSyncSafety } from '../sync/safety';
import { Setting } from '../utils/setting';

export interface DiagnosticReportSnapshot {
  generatedAt: number;
  extensionVersion: string;
  userAgent: string;
  language: string;
  storageType: string;
  deviceNameConfigured: boolean;
  enableNotifications: boolean;
  enableEncryption: boolean;
  encryptionPasswordConfigured: boolean;
  enableAutoSync: boolean;
  syncIntervalMinutes: number;
  enableSafeMode: boolean;
  safeModeDeleteThreshold: number;
  localBookmarkCount: number | null;
  rawLocalBookmarkCount: number | null;
  skippedLocalBookmarkCount: number | null;
  localUrlSchemeCounts: BookmarkUrlSchemeCounts | null;
  syncableUrlSchemeCounts: BookmarkUrlSchemeCounts | null;
  localBookmarkRoots: BookmarkRootSummary[];
  cachedLocalCount: number | null;
  cachedRemoteCount: number | null;
  webDav: DiagnosticWebDavStatus;
  gist: DiagnosticGistStatus;
  pendingSafety: DiagnosticSafetyStatus | null;
  pendingConflict: DiagnosticConflictStatus | null;
  recentHistory: DiagnosticHistoryRecord[];
}

export interface DiagnosticWebDavStatus {
  configured: boolean;
  urlConfigured: boolean;
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  pathConfigured: boolean;
  permissionOrigin: string;
  permissionStatus: DiagnosticPermissionStatus;
}

export interface DiagnosticGistStatus {
  configured: boolean;
  tokenConfigured: boolean;
  gistIdConfigured: boolean;
  fileNameConfigured: boolean;
  permissionOrigins: string[];
  permissionStatus: DiagnosticPermissionStatus;
}

export type DiagnosticPermissionStatus = 'granted' | 'missing' | 'invalid-url' | 'not-configured' | 'unavailable';

export interface DiagnosticSafetyStatus {
  blockedAt: number;
  localCount: number;
  previousRemoteCount: number;
  deletedCount: number;
  deletedPercent: number;
  threshold: number;
}

export interface DiagnosticConflictStatus {
  blockedAt: number;
  message: string;
  localChanged: boolean;
}

export interface DiagnosticHistoryRecord {
  timestamp: number;
  operation: string;
  status: string;
  storageType: string;
  bookmarkCount: number | null;
  message: string;
}

export async function generateDiagnosticReport() {
  return formatDiagnosticReport(await collectDiagnosticReportSnapshot());
}

export async function collectDiagnosticReportSnapshot(): Promise<DiagnosticReportSnapshot> {
  const setting = await Setting.build();
  const [localCounts, historyRecords, pendingSafety, pendingConflict] = await Promise.all([
    getBookmarkCounts(),
    getSyncHistoryRecords(),
    getPendingAutoSyncSafety(),
    getPendingAutoSyncConflict(),
  ]);

  return {
    generatedAt: Date.now(),
    extensionVersion: browser.runtime.getManifest().version,
    userAgent: navigator.userAgent || 'Unknown',
    language: setting.language,
    storageType: setting.storageType,
    deviceNameConfigured: Boolean(setting.deviceName.trim()),
    enableNotifications: setting.enableNotify,
    enableEncryption: setting.enableEncryption,
    encryptionPasswordConfigured: Boolean(setting.encryptionPassword),
    enableAutoSync: setting.enableAutoSync,
    syncIntervalMinutes: setting.syncIntervalMinutes,
    enableSafeMode: setting.enableSafeMode,
    safeModeDeleteThreshold: setting.safeModeDeleteThreshold,
    localBookmarkCount: localCounts.localBookmarkCount,
    rawLocalBookmarkCount: localCounts.rawLocalBookmarkCount,
    skippedLocalBookmarkCount: localCounts.skippedLocalBookmarkCount,
    localUrlSchemeCounts: localCounts.localUrlSchemeCounts,
    syncableUrlSchemeCounts: localCounts.syncableUrlSchemeCounts,
    localBookmarkRoots: localCounts.localBookmarkRoots,
    cachedLocalCount: localCounts.cachedLocalCount,
    cachedRemoteCount: localCounts.cachedRemoteCount,
    webDav: await getWebDavStatus(setting),
    gist: await getGistStatus(setting),
    pendingSafety: pendingSafety ? {
      blockedAt: pendingSafety.blockedAt,
      localCount: pendingSafety.localCount,
      previousRemoteCount: pendingSafety.previousRemoteCount,
      deletedCount: pendingSafety.deletedCount,
      deletedPercent: pendingSafety.deletedPercent,
      threshold: pendingSafety.threshold,
    } : null,
    pendingConflict: pendingConflict ? {
      blockedAt: pendingConflict.blockedAt,
      message: sanitizeReportText(pendingConflict.message),
      localChanged: pendingConflict.localChanged,
    } : null,
    recentHistory: historyRecords.slice(0, 5).map(toDiagnosticHistoryRecord),
  };
}

export function formatDiagnosticReport(snapshot: DiagnosticReportSnapshot) {
  const lines = [
    'LibreBookmarkSync Diagnostic Report',
    `Generated At: ${formatTimestamp(snapshot.generatedAt)}`,
    `Extension Version: ${snapshot.extensionVersion}`,
    `User Agent: ${sanitizeReportText(snapshot.userAgent)}`,
    '',
    'Settings',
    `- Language: ${snapshot.language}`,
    `- Storage Type: ${snapshot.storageType}`,
    `- Device Name Configured: ${formatBoolean(snapshot.deviceNameConfigured)}`,
    `- Notifications Enabled: ${formatBoolean(snapshot.enableNotifications)}`,
    `- Encryption Enabled: ${formatBoolean(snapshot.enableEncryption)}`,
    `- Encryption Password Configured: ${formatBoolean(snapshot.encryptionPasswordConfigured)}`,
    `- Auto Sync Enabled: ${formatBoolean(snapshot.enableAutoSync)}`,
    `- Sync Interval Minutes: ${snapshot.syncIntervalMinutes}`,
    `- Deletion Protection Enabled: ${formatBoolean(snapshot.enableSafeMode)}`,
    `- Deletion Threshold: ${snapshot.safeModeDeleteThreshold}%`,
    '',
    'Bookmark Counts',
    `- Live Syncable Local Count: ${formatNullableNumber(snapshot.localBookmarkCount)}`,
    `- Raw Browser URL Count: ${formatNullableNumber(snapshot.rawLocalBookmarkCount)}`,
    `- Skipped Local Count: ${formatNullableNumber(snapshot.skippedLocalBookmarkCount)}`,
    `- Raw URL Scheme Counts: ${formatUrlSchemeCounts(snapshot.localUrlSchemeCounts)}`,
    `- Syncable URL Scheme Counts: ${formatUrlSchemeCounts(snapshot.syncableUrlSchemeCounts)}`,
    `- Cached Local Count: ${formatNullableNumber(snapshot.cachedLocalCount)}`,
    `- Cached Remote Count: ${formatNullableNumber(snapshot.cachedRemoteCount)}`,
    ...formatBookmarkRootSummary(snapshot.localBookmarkRoots),
    '',
    'WebDAV',
    `- Selected/Configured: ${formatBoolean(snapshot.webDav.configured)}`,
    `- URL Configured: ${formatBoolean(snapshot.webDav.urlConfigured)}`,
    `- Username Configured: ${formatBoolean(snapshot.webDav.usernameConfigured)}`,
    `- Password Configured: ${formatBoolean(snapshot.webDav.passwordConfigured)}`,
    `- File Path Configured: ${formatBoolean(snapshot.webDav.pathConfigured)}`,
    `- Permission Origin: ${snapshot.webDav.permissionOrigin || 'not available'}`,
    `- Permission Status: ${snapshot.webDav.permissionStatus}`,
    '',
    'GitHub Gist',
    `- Selected/Configured: ${formatBoolean(snapshot.gist.configured)}`,
    `- Token Configured: ${formatBoolean(snapshot.gist.tokenConfigured)}`,
    `- Gist ID Configured: ${formatBoolean(snapshot.gist.gistIdConfigured)}`,
    `- File Name Configured: ${formatBoolean(snapshot.gist.fileNameConfigured)}`,
    `- Permission Origins: ${snapshot.gist.permissionOrigins.join(', ')}`,
    `- Permission Status: ${snapshot.gist.permissionStatus}`,
    '',
    'Pending Warnings',
    `- Safety Warning: ${snapshot.pendingSafety ? formatSafetyWarning(snapshot.pendingSafety) : 'none'}`,
    `- Conflict Warning: ${snapshot.pendingConflict ? formatConflictWarning(snapshot.pendingConflict) : 'none'}`,
    '',
    'Recent Sync History',
    ...formatRecentHistory(snapshot.recentHistory),
    '',
    'Sensitive Data Policy',
    '- This report omits passwords, tokens, Gist IDs, WebDAV file paths, bookmark titles, and bookmark URLs.',
  ];

  return lines.join('\n');
}

function toDiagnosticHistoryRecord(record: SyncHistoryRecord): DiagnosticHistoryRecord {
  return {
    timestamp: record.timestamp,
    operation: record.operation,
    status: record.status,
    storageType: record.storageType,
    bookmarkCount: Number.isFinite(record.bookmarkCount) ? record.bookmarkCount as number : null,
    message: summarizeHistoryMessage(record.message),
  };
}

async function getBookmarkCounts() {
  const cachedCounts = await browser.storage.local.get(['localCount', 'remoteCount']);
  let localBookmarkCount: number | null = null;
  let rawLocalBookmarkCount: number | null = null;
  let skippedLocalBookmarkCount: number | null = null;
  let localUrlSchemeCounts: BookmarkUrlSchemeCounts | null = null;
  let syncableUrlSchemeCounts: BookmarkUrlSchemeCounts | null = null;
  let localBookmarkRoots: BookmarkRootSummary[] = [];
  try {
    const { bookmarkTree } = await getBookmarkTree();
    const summary = summarizeBookmarkCounts(bookmarkTree);
    localBookmarkCount = countSyncableBookmarks(bookmarkTree);
    rawLocalBookmarkCount = summary.totalBookmarkCount;
    skippedLocalBookmarkCount = summary.skippedBookmarkCount;
    localUrlSchemeCounts = summary.urlSchemeCounts;
    syncableUrlSchemeCounts = summary.syncableUrlSchemeCounts;
    localBookmarkRoots = summary.roots;
  } catch (error) {
    console.error(error);
  }

  return {
    localBookmarkCount,
    rawLocalBookmarkCount,
    skippedLocalBookmarkCount,
    localUrlSchemeCounts,
    syncableUrlSchemeCounts,
    localBookmarkRoots,
    cachedLocalCount: normalizeStoredCount(cachedCounts.localCount),
    cachedRemoteCount: normalizeStoredCount(cachedCounts.remoteCount),
  };
}

async function getWebDavStatus(setting: Setting): Promise<DiagnosticWebDavStatus> {
  const urlConfigured = Boolean(setting.webdavUrl.trim());
  const usernameConfigured = Boolean(setting.webdavUsername.trim());
  const passwordConfigured = Boolean(setting.webdavPassword);
  const pathConfigured = Boolean(setting.webdavPath.trim());
  const configured = setting.storageType === 'webdav' || urlConfigured || usernameConfigured || passwordConfigured || pathConfigured;

  let permissionOrigin = '';
  let permissionStatus: DiagnosticPermissionStatus = configured ? 'missing' : 'not-configured';
  if (urlConfigured) {
    try {
      permissionOrigin = getWebDavOriginPattern(setting.webdavUrl);
      permissionStatus = await hasPermission([permissionOrigin]) ? 'granted' : 'missing';
    } catch {
      permissionStatus = 'invalid-url';
    }
  }

  return {
    configured,
    urlConfigured,
    usernameConfigured,
    passwordConfigured,
    pathConfigured,
    permissionOrigin,
    permissionStatus,
  };
}

async function getGistStatus(setting: Setting): Promise<DiagnosticGistStatus> {
  const tokenConfigured = Boolean(setting.githubToken);
  const gistIdConfigured = Boolean(setting.gistID.trim());
  const fileNameConfigured = Boolean(setting.gistFileName.trim());
  const configured = setting.storageType === 'gist' || tokenConfigured || gistIdConfigured;
  const permissionOrigins = getGistHostPermissionOrigins();
  const permissionStatus = configured
    ? await hasPermission(permissionOrigins) ? 'granted' : 'missing'
    : 'not-configured';

  return {
    configured,
    tokenConfigured,
    gistIdConfigured,
    fileNameConfigured,
    permissionOrigins,
    permissionStatus,
  };
}

async function hasPermission(origins: string[]) {
  try {
    return await browser.permissions.contains({ origins });
  } catch (error) {
    console.error(error);
    return false;
  }
}

function normalizeStoredCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function formatRecentHistory(records: DiagnosticHistoryRecord[]) {
  if (records.length === 0) {
    return ['- No sync history records.'];
  }

  return records.map(record => [
    `- ${formatTimestamp(record.timestamp)} | ${record.operation} | ${record.status} | ${record.storageType}`,
    `  Count: ${formatNullableNumber(record.bookmarkCount)}`,
    `  Message: ${summarizeHistoryMessage(record.message || '')}`,
  ].join('\n'));
}

function formatBookmarkRootSummary(roots: BookmarkRootSummary[]) {
  if (roots.length === 0) {
    return ['- Root Summary: unavailable'];
  }

  return [
    '- Root Summary:',
    ...roots.map(root => [
      `  ${root.rootIndex}: ${root.rootType}`,
      `raw ${root.bookmarkCount}`,
      `syncable ${root.syncableBookmarkCount}`,
      `raw schemes ${formatUrlSchemeCounts(root.urlSchemeCounts)}`,
      `syncable schemes ${formatUrlSchemeCounts(root.syncableUrlSchemeCounts)}`,
      root.syncable ? 'included' : 'skipped',
    ].join(' | ')),
  ];
}

function formatUrlSchemeCounts(counts: BookmarkUrlSchemeCounts | null) {
  if (!counts) {
    return 'unknown';
  }

  return [
    `total ${counts.total}`,
    `web ${counts.web}`,
    `browser-internal ${counts.browserInternal}`,
    `other ${counts.other}`,
  ].join(', ');
}

function formatSafetyWarning(safety: DiagnosticSafetyStatus) {
  return [
    `blocked at ${formatTimestamp(safety.blockedAt)}`,
    `local ${safety.localCount}`,
    `previous remote ${safety.previousRemoteCount}`,
    `deleted ${safety.deletedCount}`,
    `${safety.deletedPercent.toFixed(1)}%`,
    `threshold ${safety.threshold}%`,
  ].join(', ');
}

function formatConflictWarning(conflict: DiagnosticConflictStatus) {
  return [
    `blocked at ${formatTimestamp(conflict.blockedAt)}`,
    `local changed ${formatBoolean(conflict.localChanged)}`,
    `message ${sanitizeReportText(conflict.message)}`,
  ].join(', ');
}

function sanitizeReportText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/Basic\s+[A-Za-z0-9+/=-]+/gi, 'Basic [redacted]')
    .replace(/(token|password|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/https?:\/\/\S+/gi, '[url redacted]')
    .replace(/[A-Za-z]:\\\S+/g, '[path redacted]')
    .replace(/\/(?:[\w.-]+\/)+[\w.-]+/g, '[path redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeHistoryMessage(value: string) {
  const sanitized = sanitizeReportText(value);
  const knownErrorPatterns = [
    /\bWebDAV (?:test|download|upload) failed:\s*\d+\s+[A-Za-z ]+/i,
    /\bGitHub Gist host permission is missing\b/i,
    /\bWebDAV host permission is missing\b/i,
    /\bRemote bookmark file (?:not found|is empty)\b/i,
    /\bAuto sync blocked:\s*\d+ bookmarks would be removed \([^)]+\)\./i,
    /\bAuto sync paused:\s*[^.]+\.?/i,
    /\bUnsupported remote bookmark document\b/i,
    /\bRemote bookmark document\b[^.]+\.?/i,
  ];

  for (const pattern of knownErrorPatterns) {
    const match = pattern.exec(sanitized);
    if (match?.[0]) {
      return match[0].trim();
    }
  }

  if (sanitized.length === 0) {
    return 'none';
  }

  return 'message omitted to avoid exposing bookmark or credential details';
}

function formatTimestamp(timestamp: number) {
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toLocaleString()
    : 'unknown';
}

function formatBoolean(value: boolean) {
  return value ? 'yes' : 'no';
}

function formatNullableNumber(value: number | null) {
  return value === null ? 'unknown' : String(value);
}
