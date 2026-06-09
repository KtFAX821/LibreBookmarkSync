# LibreBookmarkSync

LibreBookmarkSync is an independent, accountless open-source browser extension for syncing bookmarks across browsers.

It is based on the publicly available Apache-2.0 licensed BookmarkHub source code, with new functionality implemented independently in this source tree. This project does not include, copy, decompile, bypass, or redistribute proprietary code from any later commercial or store-distributed version of BookmarkHub.

LibreBookmarkSync has no login, no subscription, no Pro tier, no license key, and no centralized feature authorization. User data is stored only in storage backends configured by the user.

## Current Features

- Manual bookmark upload and download.
- WebDAV storage backend by default.
- Optional GitHub Gist compatibility backend.
- Optional local auto sync timer.
- Deletion protection for risky automatic uploads.
- Local sync history.
- Local bookmark snapshots and restore.
- Optional AES-GCM encryption for remote bookmark payloads.

## Storage

LibreBookmarkSync currently supports:

- WebDAV, the default path for self-owned remote bookmark files.
- GitHub Gist, kept as an optional compatibility backend for users who already rely on it.

GitHub and WebDAV accounts are user-chosen storage backends. They are not LibreBookmarkSync accounts, and this extension does not connect to a project-owned account service.

## Encryption

Encryption is optional. When enabled, bookmark content is encrypted before upload using browser Web Crypto with AES-GCM and PBKDF2.

The encryption password is stored locally on the current device in the first implementation. It is not sent to a LibreBookmarkSync service. If the password is lost, encrypted remote bookmark data cannot be recovered.

## Local Development

Install dependencies:

```sh
corepack pnpm install
```

Type-check:

```sh
npm run compile
```

Run the WXT development server:

```sh
npm run dev
```

Build:

```sh
npm run build
```

## Project Rules

- No accounts, registration, subscription, Pro tier, trial, license key, or entitlement checks.
- No `memoload.com` or project-owned account backend.
- No Sentry or telemetry by default.
- No copied code or assets from closed store-distributed releases.
- Preserve Apache-2.0 license obligations and attribution.

## Documentation

- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Privacy policy: `docs/PRIVACY.md`
- Permissions: `docs/PERMISSIONS.md`
- Third-party licenses: `docs/THIRD_PARTY_LICENSES.md`
- Release checklist: `docs/RELEASE_CHECKLIST.md`
- Runtime smoke tests: `docs/RUNTIME_SMOKE_TESTS.md`
- GitHub publishing guide: `docs/GITHUB_PUBLISHING.md`
- Attribution notice: `NOTICE`

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
