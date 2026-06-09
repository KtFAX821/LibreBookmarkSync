# LibreBookmarkSync Release Checklist

Last updated: 2026-06-09

Use this checklist before creating a public repository, release archive, or browser-store package.

## Hard Blocks

- Do not include `fohimdklhhcpcnpmmichieidclgfdmol/` or any other closed/store-distributed package directory.
- Do not copy, port, decompile, bypass, or reuse implementation from closed store packages.
- Do not add accounts, subscriptions, Pro tiers, license keys, trials, telemetry, Sentry, or centralized entitlement checks.
- Do not connect to `memoload.com` or any project-owned account backend.

## Identity

- Use the LibreBookmarkSync project name or another approved independent name.
- Replace extension icons with independent LibreBookmarkSync assets.
- Remove old screenshots or media that visually identify the original extension.
- Keep `NOTICE` and Apache-2.0 attribution.

## Build

- Preferred full gate: run `npm.cmd run verify:release`. This now builds and checks both extension directories, runs browser-extension runtime preflight checks, and checks release zip files.
- Run `npm.cmd run test:merge`.
- Run `npm.cmd run check:docs`.
- Run `npm.cmd run check:github`.
- Run `npm.cmd run github:files` and review the minimal source file list before creating the first GitHub commit.
- Run `npm.cmd run github:prepare` if a separate checked upload folder is needed.
- Run `npm.cmd run compile`.
- Run `npm.cmd run build`.
- Run `npm.cmd run build:firefox`.
- Run `npm.cmd run check:release`.
- Run `npm.cmd run check:runtime-preflight`.
- Run `npm.cmd run zip`.
- Run `npm.cmd run zip:firefox`.
- Run `npm.cmd run check:packages`.
- Confirm all `src/public/_locales/*/messages.json` files are valid JSON.
- Inspect `.output/chrome-mv3/manifest.json` for expected Chrome MV3 name, description, permissions, and version.
- Inspect `.output/firefox-mv2/manifest.json` for expected Firefox MV2 name, description, permissions, and version.
- Confirm GitHub Gist and WebDAV host permissions are optional, not requested by default.
- Inspect `.output/*chrome.zip` and `.output/*firefox.zip` before publishing the compiled GitHub Release attachments.
- Do not upload `.output/*sources.zip` as a compiled-extension Release attachment unless a separate source-archive release is explicitly planned.
- Inspect `.output/*sources.zip` locally when WXT source packaging changes, because package checks use it to catch accidental private/local files.
- Confirm Firefox sources zip does not include `fohimdklhhcpcnpmmichieidclgfdmol/`, `.output/`, `.tmp/`, `.git/`, `.wxt/`, `node_modules/`, `docs/HANDOFF.md`, or `docs/superpowers/`.

## Runtime Smoke Tests

- Follow the detailed procedure in `docs/RUNTIME_SMOKE_TESTS.md`.
- Chinese tester-facing procedure: `docs/RUNTIME_SMOKE_TESTS_cn.md`.
- Optional launch helpers are available through `npm.cmd run smoke:list`, `npm.cmd run smoke:chrome`, `npm.cmd run smoke:edge`, and `npm.cmd run smoke:firefox`.
- Run `npm.cmd run smoke:chrome:runtime` on a machine with Chrome to verify the Chrome MV3 extension loads and renders options/popup pages in a real browser process.
- Run `npm.cmd run smoke:edge:runtime` on a machine with Edge to verify the same Chrome MV3 extension output loads and renders options/popup pages in Edge.
- Load `.output/chrome-mv3` as an unpacked Chromium extension.
- Load `.output/firefox-mv2` as a temporary Firefox extension.
- Open popup and options pages.
- Test GitHub Gist permission grant, manual upload, and manual download with a disposable Gist.
- Test WebDAV permission grant, connection test, upload, and download with a disposable WebDAV path.
- Test local snapshot creation and restore with disposable bookmarks.
- Test encrypted upload and download with a disposable remote file and password.
- Test auto-sync enable/disable and deletion-protection warning flow.
- Test auto-sync conservative merge with disposable local and remote bookmark additions.
- Test auto-sync baseline-aware merge with disposable one-sided deletion cases.
- Test auto-sync behavior for changed folders, moved bookmarks, renamed folders, and older sync state with no saved baseline.

## Documentation

- Review `docs/GITHUB_PUBLISHING.md` before initializing or pushing a GitHub repository.
- Review `README.md` and `README_cn.md`.
- Run `npm.cmd run check:docs` and confirm public documentation has no obvious mojibake/encoding regression.
- Confirm `.editorconfig` and `.gitattributes` are present before publishing to GitHub so UTF-8 text and binary assets keep stable encoding/line-ending behavior.
- Review `docs/PRIVACY.md`.
- Review `docs/PERMISSIONS.md`.
- Review `docs/THIRD_PARTY_LICENSES.md`.
- Keep `docs/HANDOFF.md` and other local handoff/test-result notes as local backups only; do not include them in the public upload folder.

## Known Cleanup

- Final-review the independent icon source at `src/assets/icon.svg` and generated package icons before store submission.
- Continue expanding focused merge tests and move/rename detection before calling auto sync feature-complete.
