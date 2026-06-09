# GitHub Development Source Publishing Guide

Last updated: 2026-06-09

This guide is for the GitHub development source upload. It is not the browser-store package and it is not the unpacked test extension directory.

Publish this project as a minimal source repository. Do not upload local build output, local browser profiles, dependency folders, private test data, or the closed/store-distributed reference package.

## Suggested Repository Metadata

Repository description:

```text
Accountless open-source browser bookmark sync with WebDAV, optional Gist, local history, snapshots, and encryption.
```

Suggested topics:

```text
browser-extension bookmarks sync webdav gist local-first apache-2-0
```

## Development Source Upload Files

Upload these files and directories:

- `src/`
- `scripts/`
- `tests/`
- `docs/GITHUB_PUBLISHING.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PERMISSIONS.md`
- `docs/PRIVACY.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/RUNTIME_SMOKE_REPORT_TEMPLATE.md`
- `docs/RUNTIME_SMOKE_TESTS.md`
- `docs/RUNTIME_SMOKE_TESTS_cn.md`
- `docs/THIRD_PARTY_LICENSES.md`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `tsconfig.tests.json`
- `wxt.config.ts`
- `README.md`
- `README_cn.md`
- `LICENSE`
- `NOTICE`
- `.gitignore`
- `.editorconfig`
- `.gitattributes`

These files are enough for another developer to install dependencies, run the release gate, inspect the legal/release boundary, and rebuild the extension packages from source.

To print the exact file list that should be included in the first GitHub source commit, run:

```powershell
npm.cmd run github:files
```

Review that output instead of using `git add .`.

To create a checked local copy containing only those files, run:

```powershell
npm.cmd run github:prepare
```

The prepared folder is written under `.tmp/`. Upload the contents of that prepared folder, not `.tmp/` itself. This prepared folder is the GitHub development source upload.

## Do Not Upload

Do not commit or upload these paths:

- `node_modules/`
- `.pnpm-store/`
- `.output/`
- `.wxt/`
- `.tmp/`
- `fohimdklhhcpcnpmmichieidclgfdmol/`
- root-level `assets/`
- root-level `images/`
- `docs/HANDOFF.md`
- `docs/superpowers/`
- `stats.html`
- `stats-*.json`
- browser profiles
- temporary runtime smoke reports
- WebDAV credentials, GitHub tokens, Gist IDs, passwords, or private bookmark exports

Keep local handoff notes and test-result notes as local backups only. Do not publish `docs/HANDOFF.md` or `docs/superpowers/`.

## Browser Extension Build Artifacts

These are separate from the GitHub development source upload. Do not commit generated extension zip files to the default branch.

For this public compiled-extension release, attach only the generated browser extension packages to a GitHub Release:

- `.output/libre-bookmark-sync-*-chrome.zip`
- `.output/libre-bookmark-sync-*-firefox.zip`

Do not attach `.output/libre-bookmark-sync-*-sources.zip` for this release. The source repository should stay reproducible from source, and the two uploaded GitHub Release files should be the compiled browser extension build artifacts.

## Pre-Publish Checks

Before running `git init` or pushing the GitHub development source upload:

1. Run `npm.cmd run check:github`.
2. Run `npm.cmd run verify:release`.
3. Run `npm.cmd run github:files` and review the exact source file list.
4. Run `npm.cmd run github:prepare` if you want a separate checked source folder for upload.
5. Confirm `git status --short --ignored` does not show ignored build/dependency/private directories staged for commit.
6. Confirm `fohimdklhhcpcnpmmichieidclgfdmol/` is not staged or uploaded.
7. Confirm `.output/`, `.tmp/`, `.wxt/`, `node_modules/`, and `.pnpm-store/` are not staged or uploaded.
8. Confirm no credentials or private bookmark exports are present in staged files.
9. Review `README.md`, `README_cn.md`, `LICENSE`, `NOTICE`, `docs/PRIVACY.md`, and `docs/PERMISSIONS.md`.

## Suggested First Commit

Use a small first commit containing only the required source files above. Keep browser extension build zip files out of the commit.

Suggested commit message:

```text
Initial LibreBookmarkSync source release
```
