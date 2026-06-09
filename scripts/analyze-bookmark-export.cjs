// SPDX-License-Identifier: Apache-2.0

const { existsSync, readFileSync } = require('node:fs');
const { basename } = require('node:path');

const inputPath = process.argv[2];

if (!inputPath || inputPath === '--help' || inputPath === '-h') {
  printHelp();
  process.exit(inputPath ? 0 : 1);
}

if (!existsSync(inputPath)) {
  fail(`Bookmark export file does not exist: ${inputPath}`);
}

const html = readFileSync(inputPath, 'utf8');
const analysis = analyzeBookmarkExport(html);
printAnalysis(analysis, inputPath);

function analyzeBookmarkExport(htmlText) {
  const hrefs = extractHrefs(htmlText);
  const duplicateCounts = countDuplicateUrls(hrefs);
  const rows = extractStructuredRows(htmlText);

  return {
    totalHrefCount: hrefs.length,
    schemeCounts: countSchemes(hrefs),
    categoryCounts: countCategories(hrefs),
    duplicateUrlGroupCount: duplicateCounts.groupCount,
    duplicateExtraEntryCount: duplicateCounts.extraEntryCount,
    structuredRows: summarizeRows(rows),
  };
}

function extractHrefs(htmlText) {
  return [...htmlText.matchAll(/<A\b[^>]*\bHREF="([^"]*)"/gi)]
    .map(match => decodeHtmlAttribute(match[1]));
}

function countSchemes(hrefs) {
  const counts = new Map();
  for (const href of hrefs) {
    const scheme = getScheme(href) || '(none)';
    counts.set(scheme, (counts.get(scheme) || 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function countCategories(hrefs) {
  const counts = {
    web: 0,
    browserInternal: 0,
    other: 0,
  };

  for (const href of hrefs) {
    counts[getCategory(href)] += 1;
  }

  return counts;
}

function countDuplicateUrls(hrefs) {
  const seen = new Map();
  for (const href of hrefs) {
    seen.set(href, (seen.get(href) || 0) + 1);
  }

  const duplicateCounts = [...seen.values()].filter(count => count > 1);
  return {
    groupCount: duplicateCounts.length,
    extraEntryCount: duplicateCounts.reduce((sum, count) => sum + count - 1, 0),
  };
}

function extractStructuredRows(htmlText) {
  const lines = htmlText.split(/\r?\n/);
  const rows = [];
  let depth = 0;
  let pendingFolder = false;

  lines.forEach((line, index) => {
    const h3Count = countMatches(line, /<H3\b/gi);
    const dlOpenCount = countMatches(line, /<DL><p>/gi);
    const dlCloseCount = countMatches(line, /<\/DL><p>/gi);
    if (h3Count > 0) {
      pendingFolder = true;
    }

    for (const hrefMatch of line.matchAll(/<A\b[^>]*\bHREF="([^"]*)"/gi)) {
      const href = decodeHtmlAttribute(hrefMatch[1]);
      rows.push({
        line: index + 1,
        depth,
        scheme: getScheme(href) || '(none)',
        category: getCategory(href),
      });
    }

    for (let index = 0; index < dlOpenCount; index += 1) {
      if (pendingFolder) {
        depth += 1;
        pendingFolder = false;
      }
    }

    for (let index = 0; index < dlCloseCount; index += 1) {
      if (depth > 0) {
        depth -= 1;
      }
    }
  });

  return rows;
}

function summarizeRows(rows) {
  const byDepth = new Map();
  for (const row of rows) {
    const summary = byDepth.get(row.depth) || {
      total: 0,
      web: 0,
      browserInternal: 0,
      other: 0,
      schemes: new Map(),
      lines: [],
    };

    summary.total += 1;
    summary[row.category] += 1;
    summary.schemes.set(row.scheme, (summary.schemes.get(row.scheme) || 0) + 1);
    summary.lines.push(row.line);
    byDepth.set(row.depth, summary);
  }

  return [...byDepth.entries()]
    .sort(([left], [right]) => left - right)
    .map(([depth, summary]) => ({
      depth,
      total: summary.total,
      web: summary.web,
      browserInternal: summary.browserInternal,
      other: summary.other,
      schemes: Object.fromEntries([...summary.schemes.entries()].sort(([left], [right]) => left.localeCompare(right))),
      lines: compactLines(summary.lines),
    }));
}

function compactLines(lines) {
  if (lines.length <= 12) {
    return lines.join(', ');
  }

  return `${lines.slice(0, 8).join(', ')}, ... ${lines.slice(-4).join(', ')}`;
}

function getCategory(href) {
  const scheme = getScheme(href);
  if (scheme === 'http' || scheme === 'https') {
    return 'web';
  }

  if ([
    'about',
    'browser',
    'chrome',
    'chrome-native',
    'edge',
    'moz-extension',
  ].includes(scheme)) {
    return 'browserInternal';
  }

  return 'other';
}

function getScheme(href) {
  return (/^([^:\s]+):/.exec(href)?.[1] || '').toLowerCase();
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function printAnalysis(analysis, filePath) {
  console.log('Bookmark Export Analysis');
  console.log(`- File: ${basename(filePath)}`);
  console.log(`- Total HREF Count: ${analysis.totalHrefCount}`);
  console.log(`- Web URL Count: ${analysis.categoryCounts.web}`);
  console.log(`- Browser-Internal URL Count: ${analysis.categoryCounts.browserInternal}`);
  console.log(`- Other URL Count: ${analysis.categoryCounts.other}`);
  console.log(`- Duplicate URL Groups: ${analysis.duplicateUrlGroupCount}`);
  console.log(`- Duplicate Extra Entries: ${analysis.duplicateExtraEntryCount}`);
  console.log('- Scheme Counts:');
  for (const [scheme, count] of Object.entries(analysis.schemeCounts)) {
    console.log(`  ${scheme}: ${count}`);
  }

  console.log('- Structure Depth Counts:');
  for (const row of analysis.structuredRows) {
    console.log([
      `  depth ${row.depth}`,
      `total ${row.total}`,
      `web ${row.web}`,
      `browser-internal ${row.browserInternal}`,
      `other ${row.other}`,
      `lines ${row.lines || 'none'}`,
    ].join(' | '));
  }

  console.log('Sensitive Data Policy: bookmark titles and URLs are not printed.');
}

function printHelp() {
  console.log('Usage: node scripts/analyze-bookmark-export.cjs <bookmarks-export.html>');
  console.log('Prints sanitized counts only. Bookmark titles and URLs are never printed.');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
