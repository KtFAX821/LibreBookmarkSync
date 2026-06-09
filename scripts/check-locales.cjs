// SPDX-License-Identifier: Apache-2.0

const { existsSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = process.cwd();
const localeDir = join(root, 'src', 'public', '_locales');
const requiredLocales = ['en', 'zh_CN'];
const failures = [];

const messagesByLocale = new Map();

for (const locale of requiredLocales) {
  const messagesPath = join(localeDir, locale, 'messages.json');
  if (!existsSync(messagesPath)) {
    fail(`${locale} locale is missing ${relative(root, messagesPath)}`);
    continue;
  }

  messagesByLocale.set(locale, readJson(messagesPath));
}

const englishMessages = messagesByLocale.get('en') || {};
for (const locale of requiredLocales.filter(locale => locale !== 'en')) {
  checkLocaleMatchesEnglish(locale, englishMessages, messagesByLocale.get(locale) || {});
}

for (const locale of requiredLocales) {
  checkMessageValues(locale, messagesByLocale.get(locale) || {});
}

report();

function checkLocaleMatchesEnglish(locale, englishMessages, localeMessages) {
  const englishKeys = Object.keys(englishMessages).sort();
  const localeKeys = Object.keys(localeMessages).sort();
  const localeKeySet = new Set(localeKeys);
  const englishKeySet = new Set(englishKeys);

  for (const key of englishKeys) {
    assert(localeKeySet.has(key), `${locale} locale is missing key ${key}`);
  }

  for (const key of localeKeys) {
    assert(englishKeySet.has(key), `${locale} locale has extra key ${key}`);
  }

  for (const key of englishKeys.filter(key => localeKeySet.has(key))) {
    const englishPlaceholders = getPlaceholders(englishMessages[key]?.message);
    const localePlaceholders = getPlaceholders(localeMessages[key]?.message);
    assert(
      sameStringSet(englishPlaceholders, localePlaceholders),
      `${locale} locale key ${key} must preserve placeholders ${Array.from(englishPlaceholders).join(', ') || '(none)'}`,
    );
  }
}

function checkMessageValues(locale, messages) {
  for (const [key, value] of Object.entries(messages)) {
    assert(value && typeof value === 'object', `${locale} locale key ${key} must be an object`);
    assert(
      typeof value.message === 'string' && value.message.trim().length > 0,
      `${locale} locale key ${key} must have a non-empty message`,
    );
    assertNoUndefinedChromePlaceholders(locale, key, value);
  }

  assert(
    String(messages.extensionName?.message || '').includes('LibreBookmarkSync'),
    `${locale} extensionName must use LibreBookmarkSync identity`,
  );
  assert(Boolean(messages.extensionDescription?.message), `${locale} extensionDescription is required`);
}

function getPlaceholders(message) {
  const placeholders = new Set();
  if (typeof message !== 'string') {
    return placeholders;
  }

  for (const match of message.matchAll(/\{[A-Z0-9_]+\}/g)) {
    placeholders.add(match[0]);
  }
  return placeholders;
}

function assertNoUndefinedChromePlaceholders(locale, key, value) {
  const placeholders = value.placeholders || {};
  const placeholderKeys = new Set(Object.keys(placeholders).map(name => name.toLowerCase()));

  for (const match of value.message.matchAll(/\$([A-Z0-9_]+)\$/gi)) {
    const placeholderName = match[1].toLowerCase();
    assert(
      placeholderKeys.has(placeholderName),
      `${locale} locale key ${key} uses Chrome i18n placeholder ${match[0]} without defining placeholders.${placeholderName}`,
    );
  }
}

function sameStringSet(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`invalid JSON at ${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  failures.push(message);
}

function report() {
  if (failures.length > 0) {
    console.error('Locale checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('locale checks passed');
}
