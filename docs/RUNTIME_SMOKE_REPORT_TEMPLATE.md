# LibreBookmarkSync Runtime Smoke Report

Use this template for each real browser-extension smoke-test run. Do not mark a browser target as passed unless it was loaded in that browser with a disposable profile.

## Run Metadata

- Date:
- Tester:
- Operating system:
- Build command:
- Build output:
- Extension package:
- Source package:

## Browser Target

- Browser:
- Browser version:
- Extension target:
- Profile path:
- Extension ID:
- Console checked:
- Result: Not run / Pass / Fail

## Automated Runtime Checks

- `npm.cmd run verify:release`:
- `npm.cmd run smoke:chrome:runtime`:
- `npm.cmd run smoke:edge:runtime`:
- Report file:
- Console/runtime errors:

## Manual Smoke Checklist

- Extension loads:
- Popup opens:
- Options page opens:
- No account/login/pro UI:
- Bookmark count updates:
- Manual upload:
- Manual download:
- Failed credentials show readable errors:
- WebDAV permission grant:
- WebDAV connection test:
- Encryption upload/download:
- Wrong encryption password fails safely:
- Snapshot creation:
- Snapshot restore:
- Auto sync enable/disable:
- Auto sync deletion protection:
- Auto sync conflict warning:
- Baseline-aware merge:

## Storage Test Data

- Storage backend:
- Disposable remote path:
- Encryption enabled:
- Disposable bookmark tree:

## Notes

- Issues found:
- Follow-up work:
