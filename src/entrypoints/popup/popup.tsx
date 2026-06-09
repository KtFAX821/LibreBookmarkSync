// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { IconContext } from 'react-icons';
import {
    AiOutlineCheckCircle,
    AiOutlineCloudDownload,
    AiOutlineCloudUpload,
    AiOutlineReload,
    AiOutlineSetting,
    AiOutlineWarning,
} from 'react-icons/ai';
import './popup.css';
import { countSyncableBookmarks, getBookmarkTree } from '../../bookmarks/bookmarkTree';
import { getSyncHistoryRecords, SyncHistoryRecord } from '../../history/syncHistory';
import optionsStorage from '../../utils/optionsStorage';
import { createTranslator, fallbackTranslator, Translator } from '../../utils/i18n';
import {
    RuntimeMessageResult,
    getRuntimeMessageError,
    sendRuntimeMessage,
} from '../../utils/runtimeMessages';

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

interface PopupOptions {
    storageType?: string;
    enableAutoSync?: boolean;
    language?: string;
}

const Popup: React.FC = () => {
    const [t, setT] = useState<Translator>(() => fallbackTranslator);
    const [count, setCount] = useState({ local: '0', remote: '0' });
    const [storageType, setStorageType] = useState('webdav');
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [latestHistory, setLatestHistory] = useState<SyncHistoryRecord | null>(null);
    const [pendingSafety, setPendingSafety] = useState<PendingSafety | null>(null);
    const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
    const [busyCommand, setBusyCommand] = useState('');
    const [commandStatus, setCommandStatus] = useState('');
    const [commandStatusKind, setCommandStatusKind] = useState<'neutral' | 'success' | 'failure'>('neutral');

    useEffect(() => {
        refreshStatus();
    }, []);

    async function refreshStatus() {
        const [data, options, historyRecords, localBookmarkCount] = await Promise.all([
            browser.storage.local.get(['localCount', 'remoteCount']),
            optionsStorage.getAll() as Promise<PopupOptions>,
            getSyncHistoryRecords(),
            getCurrentLocalBookmarkCount(),
        ]);

        const nextT = createTranslator(options.language);
        setT(() => nextT);
        setCount({
            local: String(localBookmarkCount ?? data.localCount ?? '0'),
            remote: String(data.remoteCount ?? '0'),
        });
        if (localBookmarkCount !== null) {
            await browser.storage.local.set({ localCount: localBookmarkCount });
        }
        setStorageType(options.storageType || 'webdav');
        setAutoSyncEnabled(Boolean(options.enableAutoSync));
        setLatestHistory(historyRecords[0] || null);

        const safetyResult = await sendRuntimeMessage<SafetyStatusResult>({ name: 'getSafetyStatus' });
        const safetyError = getRuntimeMessageError(safetyResult, nextT('safetyStatusLoadFailed', 'Could not load safety status.'));
        setPendingSafety(safetyError ? null : safetyResult?.safety || null);

        const conflictResult = await sendRuntimeMessage<ConflictStatusResult>({ name: 'getAutoSyncConflictStatus' });
        const conflictError = getRuntimeMessageError(conflictResult, nextT('conflictStatusLoadFailed', 'Could not load auto-sync conflict status.'));
        setPendingConflict(conflictError ? null : conflictResult?.conflict || null);

        if (safetyError || conflictError) {
            setCommandStatus(safetyError || conflictError);
            setCommandStatusKind('failure');
        }
    }

    async function sendCommand(name: string) {
        setBusyCommand(name);
        setCommandStatus(t('commandRunning', 'Running...'));
        setCommandStatusKind('neutral');
        try {
            const result = await sendRuntimeMessage({ name });
            const error = getRuntimeMessageError(result, t('commandFailed', 'Command failed.'));
            await refreshStatus();
            setCommandStatus(error || getCommandCompleteMessage(name));
            setCommandStatusKind(error ? 'failure' : 'success');
        } finally {
            setBusyCommand('');
        }
    }

    async function toggleAutoSync() {
        setBusyCommand('toggleAutoSync');
        setCommandStatus('');
        setCommandStatusKind('neutral');
        try {
            const nextValue = !autoSyncEnabled;
            await optionsStorage.set({ enableAutoSync: nextValue });
            setAutoSyncEnabled(nextValue);
            setCommandStatus(nextValue
                ? t('autoSyncEnabledStatus', 'Auto sync enabled.')
                : t('autoSyncDisabledStatus', 'Auto sync disabled.'));
            setCommandStatusKind('success');
        } catch (error) {
            setCommandStatus(error instanceof Error ? error.message : String(error));
            setCommandStatusKind('failure');
        } finally {
            setBusyCommand('');
        }
    }

    async function clearSafetyStatus() {
        setBusyCommand('clearSafetyStatus');
        setCommandStatus(t('dismissingSafetyStatus', 'Clearing warning...'));
        setCommandStatusKind('neutral');
        try {
            const result = await sendRuntimeMessage({ name: 'clearSafetyStatus' });
            const error = getRuntimeMessageError(result, t('commandFailed', 'Command failed.'));
            await refreshStatus();
            setCommandStatus(error || t('safetyStatusDismissed', 'Warning cleared.'));
            setCommandStatusKind(error ? 'failure' : 'success');
        } finally {
            setBusyCommand('');
        }
    }

    async function clearConflictStatus() {
        setBusyCommand('clearAutoSyncConflictStatus');
        setCommandStatus(t('dismissingConflictStatus', 'Clearing warning...'));
        setCommandStatusKind('neutral');
        try {
            const result = await sendRuntimeMessage({ name: 'clearAutoSyncConflictStatus' });
            const error = getRuntimeMessageError(result, t('commandFailed', 'Command failed.'));
            await refreshStatus();
            setCommandStatus(error || t('conflictStatusDismissed', 'Warning cleared.'));
            setCommandStatusKind(error ? 'failure' : 'success');
        } finally {
            setBusyCommand('');
        }
    }

    function getCommandCompleteMessage(name: string) {
        if (name === 'upload') {
            return t('uploadCommandQueued', 'Upload finished. Check the latest status below.');
        }
        if (name === 'download') {
            return t('downloadCommandQueued', 'Download finished. Check the latest status below.');
        }
        if (name === 'syncNow') {
            return t('syncCommandQueued', 'Sync finished. Check the latest status below.');
        }
        return '';
    }

    const latestStatusClass = latestHistory?.status === 'failure' ? 'is-warning' : 'is-ok';
    const latestStatusLabel = latestHistory
        ? getHistoryStatusLabel(latestHistory.status, t)
        : t('readyStatus', 'Ready');

    return (
        <IconContext.Provider value={{ className: 'popup-icon' }}>
            <main className="popup-shell">
                <header className="popup-header">
                    <div>
                        <h1>LibreBookmarkSync</h1>
                        <p>{t('popupTagline', 'Local-first bookmark sync')}</p>
                    </div>
                    <span className="header-pill">{t('localFirst', 'Local-first')}</span>
                </header>

                <section className="stats-grid" aria-label={t('popupStats', 'Sync summary')}>
                    <div className="stat-card">
                        <span>{t('localBookmarks', 'Local Bookmarks')}</span>
                        <strong>{count.local}</strong>
                    </div>
                    <div className="stat-card">
                        <span>{t('storageBackend', 'Storage')}</span>
                        <strong>{getStorageTypeLabel(storageType, t)}</strong>
                    </div>
                </section>

                <section className="status-panel">
                    <div className="status-row">
                        <span>{t('lastStatus', 'Last Status')}</span>
                        <strong className={latestStatusClass}>
                            {latestHistory?.status === 'failure' ? <AiOutlineWarning /> : <AiOutlineCheckCircle />}
                            {latestStatusLabel}
                        </strong>
                    </div>
                    <div className="status-row">
                        <span>{t('lastSync', 'Last Sync')}</span>
                        <strong>{latestHistory ? formatDate(latestHistory.timestamp) : t('neverSynced', 'Never')}</strong>
                    </div>
                    {latestHistory?.message && (
                        <p className="history-message">{latestHistory.message}</p>
                    )}
                </section>

                {(pendingSafety || pendingConflict) && (
                    <section className="warning-panel">
                        <AiOutlineWarning />
                        <div>
                            <strong>{pendingSafety ? t('autoSyncBlocked', 'Auto sync blocked') : t('autoSyncPaused', 'Auto sync paused')}</strong>
                            <p>
                                {pendingSafety
                                    ? t('bookmarksWouldBeRemoved', '{COUNT} bookmarks would be removed.').replace('{COUNT}', String(pendingSafety.deletedCount))
                                    : pendingConflict?.message}
                            </p>
                            <div className="warning-actions">
                                {pendingSafety && (
                                    <button type="button" disabled={Boolean(busyCommand)} onClick={() => sendCommand('upload')}>
                                        {t('confirmUpload', 'Confirm Upload')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={Boolean(busyCommand)}
                                    onClick={pendingSafety ? clearSafetyStatus : clearConflictStatus}
                                >
                                    {t('dismiss', 'Dismiss')}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                <section className="auto-sync-row">
                    <div>
                        <strong>{t('autoSync', 'Auto Sync')}</strong>
                        <p>{t('autoSyncPopupDesc', 'Uses your selected storage backend and local safety rules.')}</p>
                    </div>
                    <button
                        type="button"
                        className={`toggle ${autoSyncEnabled ? 'is-enabled' : ''}`}
                        aria-pressed={autoSyncEnabled}
                        aria-label={t('autoSync', 'Auto Sync')}
                        disabled={Boolean(busyCommand)}
                        onClick={toggleAutoSync}
                    >
                        <span />
                    </button>
                </section>

                <section className="action-grid">
                    <button type="button" disabled={Boolean(busyCommand)} onClick={() => sendCommand('upload')}>
                        <AiOutlineCloudUpload />
                        <span>{t('uploadBookmarks', 'Upload Bookmarks')}</span>
                    </button>
                    <button type="button" disabled={Boolean(busyCommand)} onClick={() => sendCommand('download')}>
                        <AiOutlineCloudDownload />
                        <span>{t('downloadBookmarks', 'Download Bookmarks')}</span>
                    </button>
                    <button type="button" disabled={Boolean(busyCommand)} onClick={() => sendCommand('syncNow')}>
                        <AiOutlineReload />
                        <span>{t('syncNow', 'Sync Now')}</span>
                    </button>
                </section>

                {commandStatus && (
                    <p className={`command-status is-${commandStatusKind}`}>{commandStatus}</p>
                )}

                <footer className="popup-footer">
                    <button type="button" disabled={Boolean(busyCommand)} onClick={() => sendCommand('setting')}>
                        <AiOutlineSetting />
                        <span>{t('openSettings', 'Settings')}</span>
                    </button>
                    <span>v{browser.runtime.getManifest().version}</span>
                </footer>
            </main>
        </IconContext.Provider>
    );
};

function getStorageTypeLabel(storageType: string, t: Translator) {
    if (storageType === 'webdav') {
        return t('storageWebDav', 'WebDAV');
    }
    if (storageType === 'gist') {
        return t('storageGist', 'GitHub Gist');
    }
    return t('unknownStorage', 'Unknown');
}

function getHistoryStatusLabel(status: SyncHistoryRecord['status'], t: Translator) {
    return status === 'success'
        ? t('statusSuccess', 'Success')
        : t('statusFailure', 'Failed');
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString();
}

async function getCurrentLocalBookmarkCount() {
    try {
        const { bookmarkTree } = await getBookmarkTree();
        return countSyncableBookmarks(bookmarkTree);
    } catch (error) {
        console.error(error);
        return null;
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>,
);
