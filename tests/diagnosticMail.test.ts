// SPDX-License-Identifier: Apache-2.0

import {
  createDiagnosticMailtoUrl,
  isValidEmailAddress,
} from '../src/diagnostics/diagnosticMail';

runTests();

function runTests() {
  createsMailtoUrlWithEncodedReport();
  omitsInvalidRecipient();
  validatesEmailAddresses();
  console.log('diagnosticMail tests passed');
}

function createsMailtoUrlWithEncodedReport() {
  const report = 'LibreBookmarkSync Diagnostic Report\n- Live Syncable Local Count: 56';
  const mailto = createDiagnosticMailtoUrl(report, 'support@example.test');
  const parsed = parseMailto(mailto);

  assertEqual(parsed.recipient, 'support%40example.test', 'valid recipient should be encoded in the mailto path');
  assertEqual(parsed.params.get('subject'), 'LibreBookmarkSync Diagnostic Report', 'mailto should include subject');
  assert(
    parsed.params.get('body')?.includes('- Live Syncable Local Count: 56') || false,
    'mailto body should include diagnostic report',
  );
  assert(
    parsed.params.get('body')?.includes('Review it before sending.') || false,
    'mailto body should ask the user to review before sending',
  );
}

function omitsInvalidRecipient() {
  const mailto = createDiagnosticMailtoUrl('report', 'eamil.ktfax821.cn');
  const parsed = parseMailto(mailto);

  assertEqual(parsed.recipient, '', 'invalid recipient-like domain should not be used as an email address');
  assertEqual(parsed.params.get('subject'), 'LibreBookmarkSync Diagnostic Report', 'mailto should still include subject');
}

function validatesEmailAddresses() {
  assertEqual(isValidEmailAddress('support@example.test'), true, 'valid email should pass');
  assertEqual(isValidEmailAddress(' support@example.test '), true, 'valid email should pass after trim');
  assertEqual(isValidEmailAddress('eamil.ktfax821.cn'), false, 'domain without @ should fail');
  assertEqual(isValidEmailAddress('support@'), false, 'missing host should fail');
  assertEqual(isValidEmailAddress('@example.test'), false, 'missing local part should fail');
}

function parseMailto(mailto: string) {
  assert(mailto.startsWith('mailto:'), 'mailto URL should start with mailto:');
  const withoutScheme = mailto.slice('mailto:'.length);
  const [recipient, query = ''] = withoutScheme.split('?');
  return {
    recipient,
    params: new URLSearchParams(query),
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}
