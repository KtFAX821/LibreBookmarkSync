import OptionsSync from 'webext-options-sync';
import { defaultAppSettings } from '../settings/appSettings';
import { migrateLegacyGistStorageType } from '../settings/settingNormalization';
/* global OptionsSync */

export default new OptionsSync({
    defaults: {
        language: defaultAppSettings.language,
        githubToken: '',
        gistID: '',
        gistFileName: 'libre-bookmark-sync.json',
        enableNotify: true,
        githubURL: 'https://api.github.com',
        deviceName: defaultAppSettings.deviceName,
        storageType: defaultAppSettings.storageType,
        enableEncryption: defaultAppSettings.enableEncryption,
        enableAutoSync: defaultAppSettings.enableAutoSync,
        syncIntervalMinutes: defaultAppSettings.syncIntervalMinutes,
        enableSafeMode: defaultAppSettings.enableSafeMode,
        safeModeDeleteThreshold: defaultAppSettings.safeModeDeleteThreshold,
        maxHistoryRecords: defaultAppSettings.maxHistoryRecords,
        webdavUrl: defaultAppSettings.webdavUrl,
        webdavUsername: defaultAppSettings.webdavUsername,
        webdavPassword: defaultAppSettings.webdavPassword,
        webdavPath: defaultAppSettings.webdavPath,
    },

    // List of functions that are called when the extension is updated
    migrations: [
        (savedOptions, currentDefaults) => {
            migrateLegacyGistStorageType(savedOptions);
        },

        // Integrated utility that drops any properties that don't appear in the defaults
        OptionsSync.migrations.removeUnused
    ],
    logging: false
});
