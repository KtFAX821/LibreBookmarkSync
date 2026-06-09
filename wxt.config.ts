import { defineConfig } from 'wxt';

const githubHostPermissions = [
  'https://api.github.com/*',
  'https://gist.githubusercontent.com/*',
];

const webDavOptionalHostPermissions = [
  '*://*/*',
];

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  zip: {
    includeSources: [
      '.editorconfig',
      '.gitattributes',
      'docs/GITHUB_PUBLISHING.md',
      'tests/autoSyncConflict.test.ts',
      'tests/autoSyncSchedule.test.ts',
      'tests/bookmarkMerge.test.ts',
      'tests/bookmarkTree.test.ts',
      'tests/bookmarkSnapshotData.test.ts',
      'tests/diagnosticMail.test.ts',
      'tests/diagnosticReport.test.ts',
      'tests/encryptionSettings.test.ts',
      'tests/gistAdapter.test.ts',
      'tests/gistPermissions.test.ts',
      'tests/runtimeMessages.test.ts',
      'tests/safety.test.ts',
      'tests/settingNormalization.test.ts',
      'tests/storageFactory.test.ts',
      'tests/testStorageConnection.test.ts',
      'tests/syncDocument.test.ts',
      'tests/syncHistory.test.ts',
      'tests/syncState.test.ts',
      'tests/webdavAdapter.test.ts',
      'tests/webdavPermissions.test.ts',
    ],
    excludeSources: [
      'fohimdklhhcpcnpmmichieidclgfdmol',
      'fohimdklhhcpcnpmmichieidclgfdmol/**',
      'assets',
      'assets/**',
      'images',
      'images/**',
      'docs/HANDOFF.md',
      'docs/superpowers',
      'docs/superpowers/**',
      '.output',
      '.output/**',
      '.tmp',
      '.tmp/**',
      'stats.html',
      'stats-*.json',
    ],
  },
  manifest: ({ manifestVersion }) => ({
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    permissions: ['storage', 'bookmarks', 'notifications', 'alarms'],
    optional_host_permissions: manifestVersion === 3
      ? [...githubHostPermissions, ...webDavOptionalHostPermissions]
      : undefined,
    optional_permissions: manifestVersion === 2
      ? [...githubHostPermissions, ...webDavOptionalHostPermissions]
      : undefined,
  }),
});
