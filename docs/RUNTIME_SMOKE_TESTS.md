# LibreBookmarkSync Runtime Smoke Tests

Last updated: 2026-06-08

Use this procedure after `npm.cmd run verify:release` passes. These checks are for the browser extension runtime, not a website or app server.

## Test Profile

- Use a disposable Chrome or Chromium profile and a disposable Firefox profile.
- Back up any real bookmarks before testing.
- Use a disposable GitHub Gist or disposable WebDAV path.
- Do not use the local closed release directory `fohimdklhhcpcnpmmichieidclgfdmol/` as a test reference.

## Build Outputs

- Chrome or Chromium: `.output/chrome-mv3`
- Firefox: `.output/firefox-mv2`

Rebuild before testing:

```powershell
npm.cmd run verify:release
```

`verify:release` includes `check:runtime-preflight`, which validates the built Chrome MV3 and Firefox MV2 extension directories before manual browser loading. It checks manifest shape, background entrypoints, popup/options resource references, local-only page assets, locale identity, and key background message/listener markers. This is still a preflight only; it does not prove that browser APIs, permissions prompts, remote storage, alarms, notifications, or bookmark mutations work at runtime.

Optional launch helper:

```powershell
npm.cmd run smoke:list
npm.cmd run smoke:chrome
npm.cmd run smoke:edge
npm.cmd run smoke:firefox
npm.cmd run smoke:chrome:runtime
npm.cmd run smoke:edge:runtime
```

The smoke helper creates isolated profiles under `.tmp/smoke-profiles`. Chrome and Edge start with `.output/chrome-mv3` loaded. Firefox opens `about:debugging`; load `.output/firefox-mv2/manifest.json` as a temporary add-on. The helper only opens the browser test environment and does not perform the checklist below.

`smoke:chrome:runtime` and `smoke:edge:runtime` start Chrome or Edge with `.output/chrome-mv3` in an isolated `.tmp/runtime-smoke` profile, open the extension options and popup pages through Chrome DevTools Protocol, and fail if page rendering or runtime errors are detected. They do not test bookmark mutations, remote storage credentials, WebDAV permissions, notifications, alarms, encryption recovery, or auto-sync behavior.

Chrome and Edge runtime smoke write JSON reports under `.tmp/runtime-smoke` by default. Use `node scripts/chrome-runtime-smoke.cjs --report=.tmp/runtime-smoke/chrome-report.json` or `node scripts/chrome-runtime-smoke.cjs --browser=edge --report=.tmp/runtime-smoke/edge-report.json` to choose a stable path.

## Chrome MV3

Quick start:

```powershell
npm.cmd run smoke:chrome
npm.cmd run smoke:chrome:runtime
```

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `.output/chrome-mv3`.
5. Confirm the extension name is LibreBookmarkSync.
6. Confirm the extension shows a popup, an options page, and no account/login/pro UI.
7. Open the service worker console from the extension card and keep it visible during tests.

Expected result:

- The extension loads without runtime errors.
- Required manifest permissions are limited to storage, bookmarks, notifications, and alarms.
- GitHub Gist and WebDAV host access are optional permissions that are requested only from the options page when the user configures that backend.

## Edge MV3

Quick start:

```powershell
npm.cmd run smoke:edge
npm.cmd run smoke:edge:runtime
```

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `.output/chrome-mv3`.
5. Confirm the extension name is LibreBookmarkSync.
6. Confirm the extension shows a popup, an options page, and no account/login/pro UI.
7. Open the service worker console from the extension card and keep it visible during tests.

Expected result:

- The extension loads without runtime errors.
- The options page and popup use the black/white/gray LibreBookmarkSync UI.
- There is no horizontal scrollbar in the options page at extension-sized widths.
- Required manifest permissions are limited to storage, bookmarks, notifications, and alarms.
- GitHub Gist and WebDAV host access are optional permissions that are requested only from the options page when the user configures that backend.

## Firefox MV2

Quick start:

```powershell
npm.cmd run smoke:firefox
```

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose Load Temporary Add-on.
3. Select `.output/firefox-mv2/manifest.json`.
4. Confirm the extension name is LibreBookmarkSync.
5. Open the popup and options page.
6. Watch the temporary add-on console during tests.

Expected result:

- The extension loads without runtime errors.
- Popup, options, bookmarks, storage, notifications, and alarms all work in the temporary extension.

## Disposable Bookmark Setup

Create this small test tree in the browser profile:

```text
Bookmarks Toolbar
  LibreBookmarkSync Test
    Base
    Local Only
Other Bookmarks
  LibreBookmarkSync Test Other
```

Use obvious disposable URLs such as `https://example.com/base`.

Expected result:

- The popup count reflects browser bookmark data.
- Options and popup actions do not require a user account.

## Chrome And Edge Bookmark Count Regression

Use this check after loading `.output/chrome-mv3` in Chrome or Edge, especially when the browser already has real bookmarks or favorites.

1. Open the browser bookmark manager.
2. Count the normal desktop-visible URL bookmarks in the bookmarks/favorites bar and other bookmarks/favorites.
3. Open the LibreBookmarkSync popup.
4. Confirm `Local Bookmarks` matches the desktop-visible bookmark count.
5. If Chrome shows 43 visible bookmarks, the popup should show 43, not a larger raw browser API count such as 60.
6. Upload from Chrome to a disposable or backed-up remote file.
7. Download from Edge.
8. Confirm Edge shows the same desktop-visible bookmark count and does not recreate skipped mobile, managed, or hidden roots as normal desktop bookmarks.

If the count does not match, open Options, generate the Diagnostics report, and record these lines:

- `Live Syncable Local Count`
- `Raw Browser URL Count`
- `Skipped Local Count`
- `Root Summary`

Do not share bookmark titles, bookmark URLs, WebDAV passwords, or GitHub tokens.

## Gist Manual Sync

1. Configure storage type as Gist.
2. Use a disposable GitHub token with only the minimum Gist permission needed for the test.
3. Use the GitHub Gist permission grant button in options before testing.
4. Set a disposable Gist ID or allow the existing settings flow to create/update the configured file.
5. Run manual upload from the popup.
6. Remove or rename one disposable local bookmark.
7. Run manual download.

Expected result:

- The browser prompts for optional GitHub Gist host permissions only when Gist permission is granted.
- Upload writes a LibreBookmarkSync sync document.
- Download rebuilds disposable browser bookmarks from the remote document.
- Sync history records the operation.
- No request is made to `memoload.com` or any account backend.

## WebDAV Manual Sync

1. Configure storage type as WebDAV.
2. Enter a disposable WebDAV base URL, username, password, and remote path.
3. In Chrome, use the WebDAV permission grant button before testing.
4. Run the connection test.
5. Run manual upload.
6. Change disposable local bookmarks.
7. Run manual download.

Expected result:

- Chrome prompts for the optional WebDAV host permission when needed.
- Connection test succeeds for valid credentials and fails clearly for invalid credentials.
- Upload and download use the configured WebDAV path only.
- Sync history records success and failure.

## Encryption

1. Enable encryption in options.
2. Enter a disposable password.
3. Upload to a disposable remote file.
4. Confirm the remote file does not contain plain bookmark titles or URLs.
5. Download with the same password.
6. Try downloading with a wrong password.

Expected result:

- Correct password restores bookmarks.
- Wrong password fails without replacing local bookmarks.
- The password is not shown in remote storage.

## Snapshots And Restore

1. Upload once or create a manual download test.
2. Confirm a local snapshot appears in options.
3. Add or remove a disposable bookmark.
4. Restore the earlier snapshot.

Expected result:

- Snapshot restore rebuilds bookmarks from the selected snapshot.
- A new safety snapshot is created before destructive local changes.
- Snapshot controls do not contact any remote service.

## Auto Sync

1. Enable auto sync with a short interval in a disposable profile.
2. Upload a baseline bookmark tree.
3. Change only local disposable bookmarks and wait for the alarm.
4. Change only the remote disposable file and wait for the alarm.
5. Change local and remote by adding different disposable bookmarks, then wait for the alarm.
6. Delete one baseline bookmark on one side while the other side stays unchanged, then wait for the alarm.

Expected result:

- Local-only changes upload automatically.
- Remote-only changes download automatically.
- Both-sided additions merge without dropping either addition.
- Clear one-sided deletions are accepted only when the saved baseline proves the other side is unchanged.
- Ambiguous moves, renames, duplicate folders, or changed-folder-versus-deleted-folder cases remain conservative and preserve data.
- Large deletion protection creates a warning instead of auto-uploading risky changes.

## Release Notes For Testers

Use `docs/RUNTIME_SMOKE_REPORT_TEMPLATE.md` for local smoke-test reports. Keep completed reports as local backups and do not publish browser profiles, credentials, private bookmark exports, or test-result handoff notes.

- Browser name and version.
- Build output path.
- Storage backend used.
- Encryption on or off.
- Pass/fail result.
- Any console errors.
- Automated JSON report path, if `smoke:chrome:runtime` was used.
