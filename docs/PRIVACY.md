# LibreBookmarkSync Privacy Policy

Last updated: 2026-06-08

LibreBookmarkSync is an accountless bookmark sync extension. It does not provide a LibreBookmarkSync account service and does not connect to a project-owned user database.

## Data The Extension Handles

LibreBookmarkSync can access:

- Browser bookmarks, only to upload, download, restore, count, or sync bookmarks.
- Extension settings, such as storage backend configuration, sync interval, notification preferences, and encryption settings.
- User-configured storage credentials, such as a GitHub token or WebDAV username/password.
- Local sync history and local bookmark snapshots.
- An optional encryption password stored locally on the current browser profile.

## Where Data Is Stored

Data is stored in:

- The browser extension storage area.
- User-configured remote storage. WebDAV is the default path; GitHub Gist remains available as an optional compatibility backend.

LibreBookmarkSync does not send bookmark data, credentials, or encryption passwords to a LibreBookmarkSync-operated server.

## Remote Storage

When the user chooses WebDAV or GitHub Gist, the extension sends bookmark data to that service using credentials configured by the user. Those services are independent third-party storage providers, and their own privacy policies apply.

## Encryption

Encryption is optional. When enabled, bookmark content is encrypted before upload using browser Web Crypto with AES-GCM and PBKDF2.

The first implementation stores the encryption password locally in the browser extension storage area. If the password is lost, encrypted remote bookmark data cannot be recovered.

## Telemetry

LibreBookmarkSync does not include telemetry or Sentry by default.

## Accounts And Payments

LibreBookmarkSync has no login, registration, subscription, Pro tier, license key, trial, or centralized entitlement check.

## Data Removal

Users can remove local extension data from the browser extension management page. Users must remove remote bookmark files and remote credentials from their selected storage provider separately.
