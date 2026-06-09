import { Options } from 'webext-options-sync';
import optionsStorage from './optionsStorage'
import { StorageType, defaultAppSettings } from '../settings/appSettings';
import { getLocalEncryptionPassword } from '../settings/encryptionSettings';
import {
    normalizeAppLanguage,
    normalizeMaxHistoryRecords,
    normalizeBooleanSetting,
    normalizeSafeModeDeleteThreshold,
    normalizeStorageType,
    normalizeStringSetting,
    normalizeSyncIntervalMinutes,
} from '../settings/settingNormalization';
export class SettingBase implements Options {
    constructor() { }
    [key: string]: string | number | boolean;
    language: string = defaultAppSettings.language;
    githubToken: string = '';
    gistID: string = '';
    gistFileName: string = 'libre-bookmark-sync.json';
    enableNotify: boolean = true;
    githubURL: string = 'https://api.github.com';
    deviceName: string = defaultAppSettings.deviceName;
    storageType: StorageType = defaultAppSettings.storageType;
    enableEncryption: boolean = defaultAppSettings.enableEncryption;
    encryptionPassword: string = '';
    enableAutoSync: boolean = defaultAppSettings.enableAutoSync;
    syncIntervalMinutes: number = defaultAppSettings.syncIntervalMinutes;
    enableSafeMode: boolean = defaultAppSettings.enableSafeMode;
    safeModeDeleteThreshold: number = defaultAppSettings.safeModeDeleteThreshold;
    maxHistoryRecords: number = defaultAppSettings.maxHistoryRecords;
    webdavUrl: string = defaultAppSettings.webdavUrl;
    webdavUsername: string = defaultAppSettings.webdavUsername;
    webdavPassword: string = defaultAppSettings.webdavPassword;
    webdavPath: string = defaultAppSettings.webdavPath;
}
export class Setting extends SettingBase {
    private constructor() { super() }
    static async build() {
        let options = await optionsStorage.getAll();
        let setting = new Setting();
        setting.language = normalizeAppLanguage(options.language);
        setting.gistID = normalizeStringSetting(options.gistID);
        setting.gistFileName = normalizeStringSetting(options.gistFileName, 'libre-bookmark-sync.json') || 'libre-bookmark-sync.json';
        setting.githubToken = normalizeStringSetting(options.githubToken);
        setting.enableNotify = normalizeBooleanSetting(options.enableNotify, true);
        setting.deviceName = normalizeStringSetting(options.deviceName, defaultAppSettings.deviceName);
        setting.storageType = normalizeStorageType(options.storageType);
        setting.enableEncryption = normalizeBooleanSetting(options.enableEncryption, defaultAppSettings.enableEncryption);
        setting.encryptionPassword = await getLocalEncryptionPassword();
        setting.enableAutoSync = normalizeBooleanSetting(options.enableAutoSync, defaultAppSettings.enableAutoSync);
        setting.syncIntervalMinutes = normalizeSyncIntervalMinutes(options.syncIntervalMinutes);
        setting.enableSafeMode = normalizeBooleanSetting(options.enableSafeMode, defaultAppSettings.enableSafeMode);
        setting.safeModeDeleteThreshold = normalizeSafeModeDeleteThreshold(options.safeModeDeleteThreshold);
        setting.maxHistoryRecords = normalizeMaxHistoryRecords(options.maxHistoryRecords);
        setting.webdavUrl = normalizeStringSetting(options.webdavUrl, defaultAppSettings.webdavUrl);
        setting.webdavUsername = normalizeStringSetting(options.webdavUsername, defaultAppSettings.webdavUsername);
        setting.webdavPassword = normalizeStringSetting(options.webdavPassword, defaultAppSettings.webdavPassword);
        setting.webdavPath = normalizeStringSetting(options.webdavPath, defaultAppSettings.webdavPath) || defaultAppSettings.webdavPath;
        return setting;
    }
}




// export class SettingBase {
//     constructor() { }
//     [key: string]: string | number | boolean;
//     githubToken: string = '';
//     gistID: string = '';
//     gistFileName: string = 'libre-bookmark-sync.json';
//     enableNotify: boolean = true;
//     githubURL: string = 'https://api.github.com';
// }
// export class Setting extends SettingBase {
//     private constructor() { super() }
//     static async build() {
//         let options =new Setting();
//         let setting = new Setting();
//         setting.gistID = options.gistID;
//         setting.gistFileName = options.gistFileName;
//         setting.githubToken = options.githubToken;
//         setting.enableNotify = options.enableNotify;
//         return setting;
//     }
// }
