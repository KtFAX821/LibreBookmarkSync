// SPDX-License-Identifier: Apache-2.0

const { copyFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.tests.json'], {
  stdio: 'inherit',
});

copyFileSync('tests/runtime-package.json', '.tmp/merge-tests/package.json');

execFileSync(process.execPath, ['.tmp/merge-tests/tests/bookmarkMerge.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/bookmarkTree.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/syncDocument.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/syncState.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/safety.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/gistAdapter.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/gistPermissions.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/webdavPermissions.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/webdavAdapter.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/storageFactory.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/testStorageConnection.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/runtimeMessages.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/encryptionSettings.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/syncHistory.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/bookmarkSnapshotData.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/autoSyncSchedule.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/autoSyncConflict.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/settingNormalization.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/diagnosticReport.test.js'], {
  stdio: 'inherit',
});

execFileSync(process.execPath, ['.tmp/merge-tests/tests/diagnosticMail.test.js'], {
  stdio: 'inherit',
});
