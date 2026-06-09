// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Container, Form, Button, Col, Row, InputGroup, Table, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './options.css';
import optionsStorage from '../../utils/optionsStorage';
import {
    SyncHistoryRecord,
    clearSyncHistoryRecords,
    getSyncHistoryRecords,
} from '../../history/syncHistory';
import {
    BookmarkSnapshot,
    clearBookmarkSnapshots,
    getBookmarkSnapshots,
} from '../../history/bookmarkSnapshots';
import {
    clearLocalEncryptionPassword,
    getLocalEncryptionPassword,
    setLocalEncryptionPassword,
} from '../../settings/encryptionSettings';
import { requestGistHostPermissions } from '../../storage/gistPermissions';
import { requestWebDavHostPermission } from '../../storage/webdavPermissions';
import { AppLanguage } from '../../settings/appSettings';
import { normalizeAppLanguage } from '../../settings/settingNormalization';
import { createTranslator, fallbackTranslator, resolveAppLanguage, Translator } from '../../utils/i18n';
import {
    RuntimeMessageResult,
    getRuntimeMessageError,
    sendRuntimeMessage,
} from '../../utils/runtimeMessages';
import { generateDiagnosticReport } from '../../diagnostics/diagnosticReport';
import { createDiagnosticMailtoUrl } from '../../diagnostics/diagnosticMail';

interface PendingSafety {
    blockedAt: number;
    localCount: number;
    previousRemoteCount: number;
    deletedCount: number;
    deletedPercent: number;
    threshold: number;
}

interface PendingConflict {
    blockedAt: number;
    message: string;
    localChanged: boolean;
    previousRemoteHash: string;
    currentRemoteHash: string;
}

interface SafetyStatusResult extends RuntimeMessageResult {
    safety?: PendingSafety | null;
}

interface ConflictStatusResult extends RuntimeMessageResult {
    conflict?: PendingConflict | null;
}

const OptionsPage: React.FC = () => {
    const [t, setT] = useState<Translator>(() => fallbackTranslator);
    const [language, setLanguage] = useState<AppLanguage>('auto');
    const [historyRecords, setHistoryRecords] = useState<SyncHistoryRecord[]>([]);
    const [bookmarkSnapshots, setBookmarkSnapshots] = useState<BookmarkSnapshot[]>([]);
    const [testStorageStatus, setTestStorageStatus] = useState('');
    const [pendingSafety, setPendingSafety] = useState<PendingSafety | null>(null);
    const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
    const [safetyActionStatus, setSafetyActionStatus] = useState('');
    const [busySafetyAction, setBusySafetyAction] = useState('');
    const [busySnapshotId, setBusySnapshotId] = useState('');
    const [encryptionPassword, setEncryptionPassword] = useState('');
    const [encryptionStatus, setEncryptionStatus] = useState('');
    const [webDavPermissionStatus, setWebDavPermissionStatus] = useState('');
    const [gistPermissionStatus, setGistPermissionStatus] = useState('');
    const [diagnosticReport, setDiagnosticReport] = useState('');
    const [diagnosticStatus, setDiagnosticStatus] = useState('');
    const [diagnosticBusy, setDiagnosticBusy] = useState(false);

    useEffect(() => {
        optionsStorage.syncForm('#formOptions');
        refreshLanguage();
        refreshHistoryRecords();
        refreshBookmarkSnapshots();
        refreshSafetyStatus();
        refreshEncryptionPassword();
    }, []);

    async function refreshLanguage() {
        const options = await optionsStorage.getAll();
        applyLanguage(options.language);
    }

    function applyLanguage(value: unknown) {
        const normalizedLanguage = normalizeAppLanguage(value);
        setLanguage(normalizedLanguage);
        setT(() => createTranslator(normalizedLanguage));
        document.documentElement.lang = resolveAppLanguage(normalizedLanguage).replace('_', '-');
    }

    async function changeLanguage(event: React.ChangeEvent<HTMLSelectElement>) {
        const nextLanguage = normalizeAppLanguage(event.currentTarget.value);
        applyLanguage(nextLanguage);
        await optionsStorage.set({ language: nextLanguage });
    }

    async function refreshHistoryRecords() {
        setHistoryRecords(await getSyncHistoryRecords());
    }

    async function clearHistoryRecords() {
        await clearSyncHistoryRecords();
        await refreshHistoryRecords();
    }

    async function refreshBookmarkSnapshots() {
        setBookmarkSnapshots(await getBookmarkSnapshots());
    }

    async function clearSnapshots() {
        await clearBookmarkSnapshots();
        await refreshBookmarkSnapshots();
    }

    async function refreshEncryptionPassword() {
        setEncryptionPassword(await getLocalEncryptionPassword());
    }

    async function saveEncryptionPassword() {
        await setLocalEncryptionPassword(encryptionPassword);
        setEncryptionStatus(t('encryptionPasswordSaved', 'Encryption password saved locally.'));
    }

    async function clearEncryptionPassword() {
        await clearLocalEncryptionPassword();
        setEncryptionPassword('');
        setEncryptionStatus(t('encryptionPasswordCleared', 'Encryption password cleared.'));
    }

    async function restoreSnapshot(snapshotId: string) {
        setBusySnapshotId(snapshotId);
        try {
            const result = await sendRuntimeMessage({ name: 'restoreSnapshot', snapshotId });
            if (!ensureCommandSuccess(result, setSafetyActionStatus)) {
                return;
            }
            await refreshBookmarkSnapshots();
            await refreshHistoryRecords();
        } finally {
            setBusySnapshotId('');
        }
    }

    async function testStorageConnection() {
        setTestStorageStatus(t('testingStorage', 'Testing storage connection...'));
        const result = await sendRuntimeMessage({ name: 'testStorage' });
        const error = getRuntimeMessageError(result, t('storageTestFailed', 'Storage test failed.'));
        setTestStorageStatus(error || result?.message || t('storageTestUnknown', 'Storage test completed.'));
    }

    async function grantWebDavPermission() {
        setWebDavPermissionStatus(t('grantingWebDavPermission', 'Requesting WebDAV permission...'));
        try {
            const webdavUrl = document.querySelector<HTMLInputElement>('input[name="webdavUrl"]')?.value || '';
            const origin = await requestWebDavHostPermission(webdavUrl);
            setWebDavPermissionStatus(`${t('webDavPermissionGranted', 'Permission granted for')} ${origin}`);
        } catch (error) {
            setWebDavPermissionStatus(error instanceof Error ? error.message : String(error));
        }
    }

    async function grantGistPermission() {
        setGistPermissionStatus(t('grantingGistPermission', 'Requesting GitHub Gist permission...'));
        try {
            const origins = await requestGistHostPermissions();
            setGistPermissionStatus(`${t('gistPermissionGranted', 'Permission granted for')} ${origins.join(', ')}`);
        } catch (error) {
            setGistPermissionStatus(error instanceof Error ? error.message : String(error));
        }
    }

    async function refreshSafetyStatus() {
        const result = await sendRuntimeMessage<SafetyStatusResult>({ name: 'getSafetyStatus' });
        const safetyError = getRuntimeMessageError(result, t('safetyStatusLoadFailed', 'Could not load safety status.'));
        setPendingSafety(safetyError ? null : result?.safety || null);

        const conflictResult = await sendRuntimeMessage<ConflictStatusResult>({ name: 'getAutoSyncConflictStatus' });
        const conflictError = getRuntimeMessageError(conflictResult, t('conflictStatusLoadFailed', 'Could not load auto-sync conflict status.'));
        setPendingConflict(conflictError ? null : conflictResult?.conflict || null);

        if (safetyError || conflictError) {
            setSafetyActionStatus(safetyError || conflictError);
        }
    }

    async function confirmPendingUpload() {
        setBusySafetyAction('upload');
        setSafetyActionStatus(t('confirmingUpload', 'Confirming upload...'));
        try {
            const result = await sendRuntimeMessage({ name: 'upload' });
            if (!ensureCommandSuccess(result, setSafetyActionStatus)) {
                return;
            }
            await refreshSafetyStatus();
            await refreshHistoryRecords();
            setSafetyActionStatus(t('uploadConfirmed', 'Upload completed.'));
        } finally {
            setBusySafetyAction('');
        }
    }

    async function dismissSafetyStatus() {
        setBusySafetyAction('dismiss');
        setSafetyActionStatus(t('dismissingSafetyStatus', 'Clearing warning...'));
        try {
            const result = await sendRuntimeMessage({ name: 'clearSafetyStatus' });
            if (!ensureCommandSuccess(result, setSafetyActionStatus)) {
                return;
            }
            await refreshSafetyStatus();
            setSafetyActionStatus(t('safetyStatusDismissed', 'Warning cleared.'));
        } finally {
            setBusySafetyAction('');
        }
    }

    async function dismissConflictStatus() {
        setBusySafetyAction('dismissConflict');
        setSafetyActionStatus(t('dismissingConflictStatus', 'Clearing warning...'));
        try {
            const result = await sendRuntimeMessage({ name: 'clearAutoSyncConflictStatus' });
            if (!ensureCommandSuccess(result, setSafetyActionStatus)) {
                return;
            }
            await refreshSafetyStatus();
            await refreshHistoryRecords();
            setSafetyActionStatus(t('conflictStatusDismissed', 'Warning cleared.'));
        } finally {
            setBusySafetyAction('');
        }
    }

    function ensureCommandSuccess(result: RuntimeMessageResult | undefined, setStatus: (message: string) => void) {
        const error = getRuntimeMessageError(result, t('commandFailed', 'Command failed.'));
        if (error) {
            setStatus(error);
            return false;
        }

        return true;
    }

    async function generateDiagnostics() {
        setDiagnosticBusy(true);
        setDiagnosticStatus(t('generatingDiagnostics', 'Generating diagnostic report...'));
        try {
            const report = await generateDiagnosticReport();
            setDiagnosticReport(report);
            setDiagnosticStatus(t('diagnosticsGenerated', 'Diagnostic report generated.'));
        } catch (error) {
            setDiagnosticStatus(error instanceof Error ? error.message : String(error));
        } finally {
            setDiagnosticBusy(false);
        }
    }

    async function copyDiagnostics() {
        if (!diagnosticReport) {
            return;
        }

        try {
            await navigator.clipboard.writeText(diagnosticReport);
            setDiagnosticStatus(t('diagnosticsCopied', 'Diagnostic report copied.'));
        } catch (error) {
            setDiagnosticStatus(error instanceof Error ? error.message : String(error));
        }
    }

    function emailDiagnostics() {
        if (!diagnosticReport) {
            return;
        }

        try {
            window.location.href = createDiagnosticMailtoUrl(diagnosticReport);
            setDiagnosticStatus(t('diagnosticsEmailOpened', 'Email draft opened. Review the report before sending.'));
        } catch (error) {
            setDiagnosticStatus(error instanceof Error ? error.message : String(error));
        }
    }

    return (
        <Container className="options-page">
            <header className="options-header">
                <h1>LibreBookmarkSync</h1>
                <p>{t('accountlessOpenSourceDesc', 'Accountless, subscription-free bookmark sync.')}</p>
            </header>

            <Form id="formOptions" name="formOptions">
                <section className="settings-section">
                    <h2>{t('generalSettings', 'General Settings')}</h2>
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('deviceName', 'Device Name')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="deviceName"
                                type="text"
                                placeholder={t('deviceNamePlaceholder', 'Main PC')}
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('storageType', 'Storage Type')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control name="storageType" as="select" size="sm">
                                <option value="webdav">WebDAV</option>
                                <option value="gist">GitHub Gist</option>
                            </Form.Control>
                            <Form.Text muted>
                                {t('storageTypeDesc', 'WebDAV is the default self-owned storage path. GitHub Gist remains available as a compatibility backend.')}
                            </Form.Text>
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('language', 'Interface Language')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="language"
                                as="select"
                                size="sm"
                                value={language}
                                onChange={changeLanguage}
                            >
                                <option value="auto">{t('languageAuto', 'Auto')}</option>
                                <option value="zh_CN">{t('languageChineseSimplified', 'Simplified Chinese')}</option>
                                <option value="en">{t('languageEnglish', 'English')}</option>
                            </Form.Control>
                            <Form.Text muted>
                                {t('languageDesc', 'Choose the extension UI language without changing the browser language.')}
                            </Form.Text>
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}></Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Button type="button" variant="outline-primary" size="sm" onClick={testStorageConnection}>
                                {t('testStorage', 'Test Storage')}
                            </Button>
                            {testStorageStatus && (
                                <span className="inline-status">{testStorageStatus}</span>
                            )}
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('enableNotifications', 'Enable Notifications')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Check
                                id="enableNotify"
                                name="enableNotify"
                                type="switch"
                            />
                        </Col>
                    </Form.Group>
                </section>

                <section className="settings-section">
                    <h2>WebDAV</h2>
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('webdavUrl', 'Server URL')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="webdavUrl"
                                type="url"
                                placeholder="https://dav.example.com/dav/"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('webdavUsername', 'Username')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="webdavUsername"
                                type="text"
                                placeholder="username"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('webdavPassword', 'Password')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="webdavPassword"
                                type="password"
                                placeholder="app password"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('webdavPath', 'File Path')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="webdavPath"
                                type="text"
                                placeholder="/libre-bookmark-sync.json"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}></Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Button type="button" variant="outline-primary" size="sm" onClick={grantWebDavPermission}>
                                {t('grantWebDavPermission', 'Grant WebDAV Permission')}
                            </Button>
                            {webDavPermissionStatus && (
                                <span className="inline-status">{webDavPermissionStatus}</span>
                            )}
                        </Col>
                    </Form.Group>
                </section>

                <section className="settings-section">
                    <h2>GitHub Gist</h2>
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('githubToken', 'GitHub Token')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <InputGroup size="sm">
                                <Form.Control
                                    name="githubToken"
                                    type="password"
                                    placeholder={t('githubTokenPlaceholder', 'GitHub token')}
                                    size="sm"
                                />
                                <InputGroup.Append>
                                    <Button
                                        variant="outline-secondary"
                                        as="a"
                                        target="_blank"
                                        href="https://github.com/settings/tokens/new"
                                        size="sm"
                                    >
                                        {t('getGithubToken', 'Get Token')}
                                    </Button>
                                </InputGroup.Append>
                            </InputGroup>
                            <Form.Text muted>
                                {t('gistCompatibilityDesc', 'Optional compatibility backend for existing GitHub Gist users.')}
                            </Form.Text>
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}></Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Button type="button" variant="outline-primary" size="sm" onClick={grantGistPermission}>
                                {t('grantGistPermission', 'Grant GitHub Gist Permission')}
                            </Button>
                            {gistPermissionStatus && (
                                <span className="inline-status">{gistPermissionStatus}</span>
                            )}
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('gistID', 'Gist ID')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control name="gistID" type="text" placeholder={t('gistIdPlaceholder', 'gist ID')} size="sm" />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('gistFileName', 'Gist File Name')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="gistFileName"
                                type="text"
                                placeholder="libre-bookmark-sync.json"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>
                </section>

                <section className="settings-section">
                    <h2>{t('encryptionSettings', 'Encryption Settings')}</h2>
                    <Alert variant="info" className="compact-alert">
                        {t('encryptionWarning', 'Encryption is optional. If you lose the password, encrypted remote bookmark data cannot be recovered.')}
                    </Alert>
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('enableEncryption', 'Enable Encryption')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Check
                                id="enableEncryption"
                                name="enableEncryption"
                                type="switch"
                            />
                            <Form.Text muted>
                                {t('enableEncryptionDesc', 'When enabled, remote storage receives encrypted bookmark content.')}
                            </Form.Text>
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('encryptionPassword', 'Encryption Password')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <InputGroup size="sm">
                                <Form.Control
                                    value={encryptionPassword}
                                    type="password"
                                    placeholder={t('encryptionPasswordPlaceholder', 'Stored only on this device')}
                                    size="sm"
                                    onChange={event => setEncryptionPassword(event.currentTarget.value)}
                                />
                                <InputGroup.Append>
                                    <Button type="button" variant="outline-primary" size="sm" onClick={saveEncryptionPassword}>
                                        {t('save', 'Save')}
                                    </Button>
                                    <Button type="button" variant="outline-secondary" size="sm" onClick={clearEncryptionPassword}>
                                        {t('clear', 'Clear')}
                                    </Button>
                                </InputGroup.Append>
                            </InputGroup>
                            {encryptionStatus && (
                                <Form.Text className="status-text">
                                    {encryptionStatus}
                                </Form.Text>
                            )}
                        </Col>
                    </Form.Group>
                </section>

                <section className="settings-section">
                    <h2>{t('syncSettings', 'Sync Settings')}</h2>
                    {pendingSafety && (
                        <Alert variant="warning" className="safety-alert">
                            <div>
                                <strong>{t('autoSyncBlocked', 'Auto sync blocked')}</strong>
                                <p>
                                    {t('autoSyncBlockedDesc', 'Deletion protection stopped an automatic upload because it may remove many remote bookmarks.')}
                                </p>
                                <dl>
                                    <dt>{t('previousRemoteCount', 'Previous remote count')}</dt>
                                    <dd>{pendingSafety.previousRemoteCount}</dd>
                                    <dt>{t('currentLocalCount', 'Current local count')}</dt>
                                    <dd>{pendingSafety.localCount}</dd>
                                    <dt>{t('deletedBookmarks', 'Bookmarks to remove')}</dt>
                                    <dd>{pendingSafety.deletedCount} ({pendingSafety.deletedPercent.toFixed(1)}%)</dd>
                                    <dt>{t('deleteThreshold', 'Threshold')}</dt>
                                    <dd>{pendingSafety.threshold}%</dd>
                                </dl>
                            </div>
                            <div className="safety-alert-actions">
                                <Button
                                    type="button"
                                    variant="warning"
                                    size="sm"
                                    disabled={Boolean(busySafetyAction)}
                                    onClick={confirmPendingUpload}
                                >
                                    {t('confirmUpload', 'Confirm Upload')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={Boolean(busySafetyAction)}
                                    onClick={dismissSafetyStatus}
                                >
                                    {t('dismiss', 'Dismiss')}
                                </Button>
                                {safetyActionStatus && (
                                    <span className="inline-status">{safetyActionStatus}</span>
                                )}
                            </div>
                        </Alert>
                    )}
                    {pendingConflict && (
                        <Alert variant="warning" className="safety-alert">
                            <div>
                                <strong>{t('autoSyncPaused', 'Auto sync paused')}</strong>
                                <p>{pendingConflict.message}</p>
                                <dl>
                                    <dt>{t('localChanged', 'Local changed')}</dt>
                                    <dd>{pendingConflict.localChanged ? t('yes', 'Yes') : t('no', 'No')}</dd>
                                    <dt>{t('blockedAt', 'Blocked at')}</dt>
                                    <dd>{new Date(pendingConflict.blockedAt).toLocaleString()}</dd>
                                </dl>
                            </div>
                            <div className="safety-alert-actions">
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={Boolean(busySafetyAction)}
                                    onClick={dismissConflictStatus}
                                >
                                    {t('dismiss', 'Dismiss')}
                                </Button>
                                {safetyActionStatus && (
                                    <span className="inline-status">{safetyActionStatus}</span>
                                )}
                            </div>
                        </Alert>
                    )}
                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('enableAutoSync', 'Enable Auto Sync')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Check
                                id="enableAutoSync"
                                name="enableAutoSync"
                                type="switch"
                            />
                            <Form.Text muted>
                                {t('enableAutoSyncDesc', 'Auto sync is local-only and never requires an account.')}
                            </Form.Text>
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('syncIntervalMinutes', 'Sync Interval')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control name="syncIntervalMinutes" as="select" size="sm">
                                <option value="5">{t('minutes5', '5 minutes')}</option>
                                <option value="10">{t('minutes10', '10 minutes')}</option>
                                <option value="15">{t('minutes15', '15 minutes')}</option>
                                <option value="30">{t('minutes30', '30 minutes')}</option>
                                <option value="60">{t('minutes60', '60 minutes')}</option>
                            </Form.Control>
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('enableSafeMode', 'Deletion Protection')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Check
                                id="enableSafeMode"
                                name="enableSafeMode"
                                type="switch"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('safeModeDeleteThreshold', 'Delete Threshold (%)')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="safeModeDeleteThreshold"
                                type="number"
                                min="1"
                                max="100"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>

                    <Form.Group as={Row}>
                        <Form.Label column="sm" sm={4} lg={3} xs={12}>
                            {t('maxHistoryRecords', 'History Records')}
                        </Form.Label>
                        <Col sm={8} lg={9} xs={12}>
                            <Form.Control
                                name="maxHistoryRecords"
                                type="number"
                                min="10"
                                max="500"
                                size="sm"
                            />
                        </Col>
                    </Form.Group>
                </section>

                <section className="settings-section">
                    <div className="section-title-row">
                        <h2>{t('syncHistory', 'Sync History')}</h2>
                        <div>
                            <Button type="button" variant="outline-secondary" size="sm" onClick={refreshHistoryRecords}>
                                {t('refresh', 'Refresh')}
                            </Button>
                            <Button type="button" variant="outline-danger" size="sm" onClick={clearHistoryRecords}>
                                {t('clearHistory', 'Clear')}
                            </Button>
                        </div>
                    </div>
                    {historyRecords.length === 0 ? (
                        <p className="empty-state">{t('noSyncHistory', 'No sync history yet.')}</p>
                    ) : (
                        <Table size="sm" responsive>
                            <thead>
                                <tr>
                                    <th>{t('historyTime', 'Time')}</th>
                                    <th>{t('historyOperation', 'Operation')}</th>
                                    <th>{t('historyStatus', 'Status')}</th>
                                    <th>{t('historyStorage', 'Storage')}</th>
                                    <th>{t('historyCount', 'Count')}</th>
                                    <th>{t('historyMessage', 'Message')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyRecords.map(record => (
                                    <tr key={record.id}>
                                        <td>{new Date(record.timestamp).toLocaleString()}</td>
                                        <td>{record.operation}</td>
                                        <td>{record.status}</td>
                                        <td>{record.storageType}</td>
                                        <td>{record.bookmarkCount ?? '-'}</td>
                                        <td>{record.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </section>

                <section className="settings-section">
                    <div className="section-title-row">
                        <h2>{t('localSnapshots', 'Local Snapshots')}</h2>
                        <div>
                            <Button type="button" variant="outline-secondary" size="sm" onClick={refreshBookmarkSnapshots}>
                                {t('refresh', 'Refresh')}
                            </Button>
                            <Button type="button" variant="outline-danger" size="sm" onClick={clearSnapshots}>
                                {t('clearSnapshots', 'Clear')}
                            </Button>
                        </div>
                    </div>
                    {bookmarkSnapshots.length === 0 ? (
                        <p className="empty-state">{t('noLocalSnapshots', 'No local snapshots yet.')}</p>
                    ) : (
                        <Table size="sm" responsive>
                            <thead>
                                <tr>
                                    <th>{t('snapshotTime', 'Time')}</th>
                                    <th>{t('snapshotReason', 'Reason')}</th>
                                    <th>{t('snapshotDevice', 'Device')}</th>
                                    <th>{t('snapshotCount', 'Count')}</th>
                                    <th>{t('snapshotAction', 'Action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookmarkSnapshots.map(snapshot => (
                                    <tr key={snapshot.id}>
                                        <td>{new Date(snapshot.timestamp).toLocaleString()}</td>
                                        <td>{snapshot.reason}</td>
                                        <td>{snapshot.deviceName}</td>
                                        <td>{snapshot.bookmarkCount}</td>
                                        <td>
                                            <Button
                                                type="button"
                                                variant="outline-primary"
                                                size="sm"
                                                disabled={Boolean(busySnapshotId)}
                                                onClick={() => restoreSnapshot(snapshot.id)}
                                            >
                                                {busySnapshotId === snapshot.id
                                                    ? t('restoringSnapshot', 'Restoring...')
                                                    : t('restoreSnapshot', 'Restore')}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </section>

                <section className="settings-section">
                    <div className="section-title-row">
                        <h2>{t('diagnostics', 'Diagnostics')}</h2>
                        <div>
                            <Button
                                type="button"
                                variant="outline-primary"
                                size="sm"
                                disabled={diagnosticBusy}
                                onClick={generateDiagnostics}
                            >
                                {t('generateDiagnostics', 'Generate Report')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline-secondary"
                                size="sm"
                                disabled={!diagnosticReport}
                                onClick={copyDiagnostics}
                            >
                                {t('copyDiagnostics', 'Copy')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline-secondary"
                                size="sm"
                                disabled={!diagnosticReport}
                                onClick={emailDiagnostics}
                            >
                                {t('emailDiagnostics', 'Email')}
                            </Button>
                        </div>
                    </div>
                    {diagnosticStatus && (
                        <p className="status-text">{diagnosticStatus}</p>
                    )}
                    {diagnosticReport && (
                        <Form.Control
                            as="textarea"
                            className="diagnostic-report"
                            readOnly
                            value={diagnosticReport}
                        />
                    )}
                </section>
            </Form>
        </Container>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <OptionsPage />
    </React.StrictMode>,
);
