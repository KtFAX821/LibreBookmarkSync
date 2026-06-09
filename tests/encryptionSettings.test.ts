// SPDX-License-Identifier: Apache-2.0

import { normalizeLocalEncryptionPassword } from '../src/settings/encryptionSettings';

runTests();

function runTests() {
  preservesStringPasswords();
  preservesEmptyPasswords();
  rejectsCorruptPasswordValues();
  console.log('encryptionSettings tests passed');
}

function preservesStringPasswords() {
  assertEqual(
    normalizeLocalEncryptionPassword('correct horse battery staple'),
    'correct horse battery staple',
    'string passwords should be preserved',
  );
}

function preservesEmptyPasswords() {
  assertEqual(normalizeLocalEncryptionPassword(''), '', 'empty password should remain empty');
}

function rejectsCorruptPasswordValues() {
  assertEqual(normalizeLocalEncryptionPassword(null), '', 'null should not become a password');
  assertEqual(normalizeLocalEncryptionPassword(undefined), '', 'undefined should not become a password');
  assertEqual(normalizeLocalEncryptionPassword(123), '', 'numbers should not become passwords');
  assertEqual(normalizeLocalEncryptionPassword(['secret']), '', 'arrays should not become passwords');
  assertEqual(normalizeLocalEncryptionPassword({ password: 'secret' }), '', 'objects should not become passwords');
  assertEqual(normalizeLocalEncryptionPassword(true), '', 'booleans should not become passwords');
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
