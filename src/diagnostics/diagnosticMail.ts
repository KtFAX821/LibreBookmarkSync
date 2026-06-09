// SPDX-License-Identifier: Apache-2.0

const DEFAULT_DIAGNOSTIC_EMAIL_RECIPIENT = 'eamil@ktfax821.cn';
const DIAGNOSTIC_EMAIL_SUBJECT = 'LibreBookmarkSync Diagnostic Report';

export function createDiagnosticMailtoUrl(report: string, recipient = DEFAULT_DIAGNOSTIC_EMAIL_RECIPIENT) {
  const normalizedRecipient = isValidEmailAddress(recipient) ? recipient.trim() : '';
  const body = [
    'LibreBookmarkSync diagnostic report',
    '',
    'This report is generated locally by the extension. Review it before sending.',
    '',
    report,
  ].join('\n');

  const params = new URLSearchParams({
    subject: DIAGNOSTIC_EMAIL_SUBJECT,
    body,
  });

  return `mailto:${encodeURIComponent(normalizedRecipient)}?${params.toString()}`;
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
