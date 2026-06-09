// SPDX-License-Identifier: Apache-2.0

const { readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = process.cwd();
const failures = [];

const files = {
  options: join(root, 'src', 'entrypoints', 'options', 'options.css'),
  popup: join(root, 'src', 'entrypoints', 'popup', 'popup.css'),
};

const optionsCss = readCss(files.options);
const popupCss = readCss(files.popup);

checkOptionsTheme(optionsCss);
checkPopupTheme(popupCss);
checkSwitchContrast(optionsCss, popupCss);
checkUnifiedNeutralPalette(optionsCss, files.options);
checkUnifiedNeutralPalette(popupCss, files.popup);

report();

function checkOptionsTheme(css) {
  assert(
    hasDeclaration(css, ':root', 'color-scheme', 'dark'),
    'options CSS must declare dark color-scheme',
  );
  assert(
    hasDeclaration(css, 'html,\nbody', 'background', '#050505') || hasDeclaration(css, 'body', 'background', '#050505'),
    'options page body must keep the black background',
  );
  assert(
    hasDeclaration(css, '#root', 'min-width', '0'),
    'options root must keep min-width: 0 to avoid extension-window horizontal scrolling',
  );
  assert(
    hasDeclaration(css, '#root', 'overflow-x', 'hidden'),
    'options root must hide horizontal overflow',
  );
  assert(
    hasDeclaration(css, '.form-control', 'background', '#111'),
    'options form controls must keep a dark background',
  );
  assert(
    hasDeclaration(css, '.table-responsive', 'background', '#0b0b0b'),
    'options tables must keep a dark background',
  );

  const fixedRootWidthPattern = /#root\s*\{[^}]*\bmin-width\s*:\s*(?!0\b)\d+px/i;
  assert(
    !fixedRootWidthPattern.test(css),
    'options root must not use a fixed pixel min-width',
  );
}

function checkPopupTheme(css) {
  assert(
    hasDeclaration(css, ':root', 'color-scheme', 'dark'),
    'popup CSS must declare dark color-scheme',
  );
  assert(
    hasDeclaration(css, 'body', 'background', '#050505'),
    'popup body must keep the black background',
  );
  assert(
    hasDeclaration(css, '.popup-shell', 'background', '#050505'),
    'popup shell must keep the black background',
  );
  assert(
    hasDeclaration(css, '.popup-shell', 'color', '#f5f5f5'),
    'popup shell must keep white foreground text',
  );
}

function checkSwitchContrast(optionsCss, popupCss) {
  assert(
    hasDeclaration(optionsCss, '.custom-switch .custom-control-label::before', 'background', '#050505'),
    'options switch off track must use a high-contrast black background',
  );
  assert(
    hasDeclaration(optionsCss, '.custom-switch .custom-control-label::after', 'background', '#f5f5f5'),
    'options switch off knob must use a high-contrast white foreground',
  );
  assert(
    hasDeclaration(optionsCss, '.custom-control-input:checked ~ .custom-control-label::before', 'background', '#f5f5f5'),
    'options switch on track must invert to a white background',
  );
  assert(
    hasDeclaration(optionsCss, '.custom-control-input:checked ~ .custom-control-label::after', 'background', '#050505'),
    'options switch on knob must invert to a black foreground',
  );
  assert(
    hasDeclaration(popupCss, '.toggle', 'background', '#050505'),
    'popup switch off track must use a high-contrast black background',
  );
  assert(
    hasDeclaration(popupCss, '.toggle span', 'background', '#f5f5f5'),
    'popup switch off knob must use a high-contrast white foreground',
  );
  assert(
    hasDeclaration(popupCss, '.toggle.is-enabled', 'background', '#f5f5f5'),
    'popup switch on track must invert to a white background',
  );
  assert(
    hasDeclaration(popupCss, '.toggle.is-enabled span', 'background', '#050505'),
    'popup switch on knob must invert to a black foreground',
  );
}

function checkUnifiedNeutralPalette(css, filePath) {
  const forbiddenThemePatterns = [
    { pattern: /background\s*:\s*(?:#fff(?:fff)?|\bwhite\b)/i, label: 'white background' },
    { pattern: /background-color\s*:\s*(?:#fff(?:fff)?|\bwhite\b)/i, label: 'white background-color' },
    { pattern: /#(?:0f766e|14b8a6|2dd4bf|5eead4|99f6e4)\b/i, label: 'teal accent color' },
    { pattern: /rgba\(\s*20\s*,\s*184\s*,\s*166\b/i, label: 'teal accent rgba' },
    { pattern: /rgba\(\s*45\s*,\s*212\s*,\s*191\b/i, label: 'teal accent rgba' },
  ];

  for (const { pattern, label } of forbiddenThemePatterns) {
    if (pattern.test(css)) {
      fail(`${relative(root, filePath)} must stay black/white/gray and must not contain ${label}`);
    }
  }
}

function hasDeclaration(css, selector, property, value) {
  const escapedSelector = escapeRegExp(selector).replace(/\\\n/g, '\\s*');
  const selectorPattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 'i');
  const match = selectorPattern.exec(css);
  if (!match?.groups?.body) {
    return false;
  }

  const declarationPattern = new RegExp(`\\b${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*(?:;|$)`, 'i');
  return declarationPattern.test(match.groups.body);
}

function readCss(path) {
  try {
    return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    fail(`could not read ${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    console.error('UI style checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('ui style checks passed');
}
