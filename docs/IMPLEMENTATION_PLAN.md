# LibreBookmarkSync Implementation Plan

This plan tracks the local development path from the current open-source BookmarkHub codebase to LibreBookmarkSync, an accountless and fully open bookmark sync extension.

## Project Rules

- No login, registration, account backend, subscription, Pro tier, license key, or entitlement check.
- No `memoload.com`, Sentry, project-owned telemetry, or centralized feature authorization.
- No copied, decompiled, bypassed, or redistributed code from the closed store-distributed 1.0.3 package.
- Keep the original Apache-2.0 license and add clear attribution before public release.
- New functionality must be independently implemented in this source tree.

## Current Status

Milestones 1 through 7 have first-pass local implementations in this source tree. The preferred release gate is:

```powershell
npm.cmd run verify:release
```

That gate runs the focused Node-level tests, TypeScript compile, Chrome MV3 build, Firefox MV2 build, runtime preflight checks, package checks, documentation checks, GitHub publishing checks, locale checks, and UI style checks.

Remaining work before calling the extension feature-complete is mostly browser-extension runtime validation and conservative sync hardening:

- Firefox MV2 temporary-extension testing.
- Optional GitHub Gist permission/upload/download testing.
- Encryption upload/download testing with disposable data.
- Local snapshot restore testing with disposable bookmarks.
- Auto-sync edge-case testing for move, rename, duplicate-folder, deletion, and mixed-edit scenarios.
- Browser-store submission review for icon, permissions, privacy text, and listing copy.

Runtime test reports and handoff notes are local-only records. Do not publish `docs/HANDOFF.md`, `docs/superpowers/`, browser profiles, credentials, private bookmark exports, or temporary smoke-test reports.

## Milestone 1: Safe Refactor

Status: first-pass implemented.

Goal: split the current single-file background implementation into clear modules without changing user-visible behavior.

Tasks:

- Create module boundaries for bookmark tree operations, notifications, and Gist manual sync.
- Keep existing popup message names: `upload`, `download`, `removeAll`, `setting`.
- Keep existing Gist upload/download behavior.
- Keep existing bookmark change badge behavior.
- Run TypeScript compile.

Completion criteria:

- `src/entrypoints/background.ts` is mostly orchestration.
- Existing manual Gist sync still compiles.
- Handoff log states what changed and where to continue.

## Milestone 2: Accountless Settings Model

Status: first-pass implemented.

Goal: prepare settings for multiple storage backends and auto sync without introducing accounts.

Tasks:

- Add local settings defaults for storage type, device name, auto sync interval, safe mode, WebDAV fields, and sync history retention.
- Preserve migration from old Gist settings.
- Update options UI enough to edit the new fields.

Completion criteria:

- Old Gist settings still load.
- New settings are stored locally.
- No account-related fields exist.

## Milestone 3: Sync Engine MVP

Status: first-pass implemented.

Goal: introduce a backend-independent sync engine.

Tasks:

- Define versioned remote document format.
- Define storage adapter interface.
- Move Gist behind the adapter interface.
- Add local sync records.
- Add conservative safety checks.

Completion criteria:

- Manual sync uses the new engine with Gist.
- Sync history records success and failure.
- Risky delete operations are detectable before auto sync is added.

## Milestone 4: WebDAV Backend

Status: first-pass implemented; runtime validation should continue against real disposable WebDAV endpoints.

Goal: add accountless self-hosted/cloud storage support.

Tasks:

- Implement WebDAV adapter with basic auth.
- Add connection test.
- Add WebDAV settings UI.
- Add permission handling for WebDAV URLs if needed.

Completion criteria:

- Upload/download works against a configured WebDAV endpoint.
- Gist remains functional.

## Milestone 5: Auto Sync

Status: first-pass implemented; intentionally conservative and still needs broader real-browser runtime validation.

Goal: add local timer-based sync with safety protection.

Tasks:

- Add `alarms` permission.
- Schedule or clear alarms when settings change.
- Trigger sync from alarm.
- Block risky auto sync and show badge/notification.
- Conservatively merge local and remote additions when both sides changed.
- Save a local previous-sync baseline so clear one-sided deletions can be accepted when the other side is unchanged.
- Keep ambiguous move, rename, and changed-folder cases conservative until they are covered by runtime tests and focused merge tests.

Completion criteria:

- Auto sync can be enabled without any account.
- Auto sync never requires remote entitlement.
- Large deletion protection works.
- Common two-device additions merge without contacting any project-owned backend.
- Clear one-sided deletions can merge when the previous sync baseline proves the other side did not change.

## Milestone 6: History And Restore

Status: first-pass implemented; restore should continue to be tested with disposable bookmarks before use on important profiles.

Goal: make sync operations auditable and recoverable.

Tasks:

- Keep latest 100 sync records.
- Store bounded local snapshots.
- Add history view.
- Add restore from local snapshot.

Completion criteria:

- Users can inspect recent sync attempts.
- Users can recover from a local snapshot.

## Milestone 7: Encryption

Status: first-pass implemented; runtime validation should continue with disposable encrypted remote files.

Goal: add optional end-to-end encryption.

Tasks:

- Implement AES-GCM helpers with Web Crypto.
- Encrypt only the bookmark payload.
- Warn clearly about lost passwords.
- Add encryption settings UI.

Completion criteria:

- Remote storage can hold encrypted data.
- Password/key never leaves the browser except as user-configured storage data if the user explicitly exports settings.

## Milestone 8: Public Release Preparation

Status: source and compiled-extension release boundaries are prepared; browser-store submission review remains.

Goal: prepare a separate public project and extension release.

Tasks:

- Choose final name and branding.
- Add `NOTICE`.
- Add SPDX headers to new source files.
- Replace original extension identity and icons.
- Write privacy policy and permissions documentation.
- Inventory third-party licenses.

Completion criteria:

- Public repository and store package are legally and technically separated from the original extension identity.
