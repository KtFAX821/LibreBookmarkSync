// SPDX-License-Identifier: Apache-2.0

import { getGistHostPermissionOrigins } from '../src/storage/gistPermissions';

runTests();

function runTests() {
  exposesOnlyTheGistHostsNeededForCompatibilityBackend();
  returnsCopiesOfThePermissionOrigins();
  console.log('gistPermissions tests passed');
}

function exposesOnlyTheGistHostsNeededForCompatibilityBackend() {
  assertEqual(
    getGistHostPermissionOrigins().join(','),
    'https://api.github.com/*,https://gist.githubusercontent.com/*',
    'Gist permission origins should be scoped to the API and raw Gist content hosts',
  );
}

function returnsCopiesOfThePermissionOrigins() {
  const first = getGistHostPermissionOrigins();
  first.push('https://example.invalid/*');

  assertEqual(
    getGistHostPermissionOrigins().includes('https://example.invalid/*'),
    false,
    'Gist permission origins should not expose mutable module state',
  );
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
