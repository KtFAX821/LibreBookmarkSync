// SPDX-License-Identifier: Apache-2.0

import {
  countBookmarks,
  countSyncableBookmarks,
  detectBrowserType,
  filterSyncableBookmarkRoots,
  formatBookmarksForSync,
  summarizeBookmarkCounts,
} from '../src/bookmarks/bookmarkTree';
import { BookmarkInfo, BrowserType, RootBookmarksType } from '../src/utils/models';

runTests();

function runTests() {
  detectsChromeBookmarkRoots();
  detectsFirefoxBookmarkRoots();
  countsNestedBookmarksOnlyWhenTheyHaveUrls();
  summarizesBookmarkUrlSchemes();
  formatsChromeRootsForSync();
  formatsEdgeChineseFavoritesRootsForSync();
  formatsFirefoxRootsForSync();
  excludesMobileManagedAndUnknownRootsFromDesktopSyncCount();
  filtersLegacyRemoteMobileRoots();
  stripsBrowserManagedFieldsWithoutMutatingTheOriginalTree();
  console.log('bookmarkTree tests passed');
}

function detectsChromeBookmarkRoots() {
  assertEqual(
    detectBrowserType([{ id: '0', title: '', children: [] }]),
    BrowserType.CHROME,
    'Chrome-style root should be detected as Chrome',
  );
}

function detectsFirefoxBookmarkRoots() {
  assertEqual(
    detectBrowserType([{ id: 'root________', title: '', children: [] }]),
    BrowserType.FIREFOX,
    'Firefox-style root should be detected as Firefox',
  );
}

function countsNestedBookmarksOnlyWhenTheyHaveUrls() {
  const bookmarks = [
    new BookmarkInfo('Folder', undefined, [
      new BookmarkInfo('One', 'https://one.example'),
      new BookmarkInfo('Nested', undefined, [
        new BookmarkInfo('Two', 'https://two.example'),
        new BookmarkInfo('Separator'),
      ]),
    ]),
    new BookmarkInfo('Three', 'https://three.example'),
  ];

  assertEqual(countBookmarks(bookmarks), 3, 'bookmark count should include only URL nodes');
  assertEqual(countBookmarks(undefined), 0, 'missing bookmark list should count as zero');
}

function summarizesBookmarkUrlSchemes() {
  const tree = [
    new BookmarkInfo('Web', 'https://web.example'),
    new BookmarkInfo('Internal', 'chrome://newtab/'),
    new BookmarkInfo('Other', 'file:///tmp/bookmark.html'),
    new BookmarkInfo('Nested', undefined, [
      new BookmarkInfo('Edge Internal', 'edge://newtab/'),
    ]),
  ];
  const summary = summarizeBookmarkCounts([
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: tree,
        },
      ],
    },
  ]);

  assertEqual(summary.urlSchemeCounts.total, 4, 'scheme summary should count all URL bookmarks');
  assertEqual(summary.urlSchemeCounts.web, 1, 'scheme summary should count http/https URLs');
  assertEqual(summary.urlSchemeCounts.browserInternal, 2, 'scheme summary should count browser-internal URLs');
  assertEqual(summary.urlSchemeCounts.other, 1, 'scheme summary should count other URL schemes');
  assertEqual(summary.syncableUrlSchemeCounts.total, 4, 'syncable scheme summary should include syncable root URLs');
}

function formatsChromeRootsForSync() {
  const formatted = formatBookmarksForSync([
    {
      id: '0',
      title: '',
      children: [
        rootNode('1', 'Bookmarks Bar'),
        rootNode('2', 'Other Bookmarks'),
        rootNode('3', 'Mobile Bookmarks'),
      ],
    },
  ]) || [];

  assertEqual(formatted[0].title, RootBookmarksType.ToolbarFolder, 'Chrome toolbar root should be normalized');
  assertEqual(formatted[1].title, RootBookmarksType.UnfiledFolder, 'Chrome other root should be normalized');
  assertEqual(formatted.length, 2, 'Chrome mobile root should be excluded from desktop sync');
}

function formatsEdgeChineseFavoritesRootsForSync() {
  const formatted = formatBookmarksForSync([
    {
      id: '0',
      title: '',
      children: [
        rootNode('favorites-bar', '\u6536\u85cf\u5939\u680f'),
        rootNode('other-favorites', '\u5176\u4ed6\u6536\u85cf\u5939'),
        rootNode('mobile-favorites', '\u79fb\u52a8\u6536\u85cf\u5939'),
      ],
    },
  ]) || [];

  assertEqual(formatted[0].title, RootBookmarksType.ToolbarFolder, 'Edge Chinese favorites bar root should be normalized');
  assertEqual(formatted[1].title, RootBookmarksType.UnfiledFolder, 'Edge Chinese other favorites root should be normalized');
  assertEqual(formatted.length, 2, 'Edge Chinese mobile favorites root should be excluded from desktop sync');
  assertEqual(countBookmarks(formatted), 2, 'Edge Chinese formatted roots should keep desktop favorites');
}

function formatsFirefoxRootsForSync() {
  const formatted = formatBookmarksForSync([
    {
      id: 'root________',
      title: '',
      children: [
        rootNode('menu________', 'menu'),
        rootNode('toolbar_____', 'toolbar'),
        rootNode('unfiled_____', 'unfiled'),
        rootNode('mobile______', 'mobile'),
      ],
    },
  ]) || [];

  assertEqual(formatted[0].title, RootBookmarksType.MenuFolder, 'Firefox menu root should be normalized');
  assertEqual(formatted[1].title, RootBookmarksType.ToolbarFolder, 'Firefox toolbar root should be normalized');
  assertEqual(formatted[2].title, RootBookmarksType.UnfiledFolder, 'Firefox unfiled root should be normalized');
  assertEqual(formatted.length, 3, 'Firefox mobile root should be excluded from desktop sync');
}

function excludesMobileManagedAndUnknownRootsFromDesktopSyncCount() {
  const tree = [
    {
      id: '0',
      title: '',
      children: [
        rootNodeWithCount('1', 'Bookmarks Bar', 40),
        rootNodeWithCount('2', 'Other Bookmarks', 3),
        rootNodeWithCount('3', 'Mobile Bookmarks', 17),
        rootNodeWithCount('managed-root', 'Managed Bookmarks', 5, 'managed'),
      ],
    },
  ];
  const summary = summarizeBookmarkCounts(tree);

  assertEqual(countBookmarks(tree), 65, 'raw browser count should include every URL node');
  assertEqual(countSyncableBookmarks(tree), 43, 'syncable count should match desktop-visible bookmarks');
  assertEqual(summary.totalBookmarkCount, 65, 'summary should include raw browser count');
  assertEqual(summary.syncableBookmarkCount, 43, 'summary should include syncable count');
  assertEqual(summary.skippedBookmarkCount, 22, 'summary should show skipped mobile and managed bookmarks');
}

function filtersLegacyRemoteMobileRoots() {
  const remoteBookmarks = [
    rootNodeWithCount('', RootBookmarksType.ToolbarFolder, 40),
    rootNodeWithCount('', RootBookmarksType.UnfiledFolder, 3),
    rootNodeWithCount('', RootBookmarksType.MobileFolder, 17),
  ];
  const filtered = filterSyncableBookmarkRoots(remoteBookmarks);

  assertEqual(filtered.length, 2, 'legacy remote mobile root should be filtered');
  assertEqual(countBookmarks(filtered), 43, 'filtered legacy remote document should keep desktop bookmarks');
}

function stripsBrowserManagedFieldsWithoutMutatingTheOriginalTree() {
  const tree = [
    {
      id: '0',
      parentId: '',
      index: 0,
      title: '',
      dateAdded: 100,
      dateGroupModified: 200,
      type: 'folder' as const,
      children: [
        {
          id: '1',
          parentId: '0',
          index: 0,
          title: 'Bookmarks Bar',
          dateAdded: 101,
          dateGroupModified: 201,
          type: 'folder' as const,
          children: [
            {
              id: 'bookmark-1',
              parentId: '1',
              index: 0,
              title: 'Example',
              url: 'https://example.com',
              dateAdded: 102,
              type: 'bookmark' as const,
            },
          ],
        },
      ],
    },
  ];

  const formatted = formatBookmarksForSync(tree) || [];
  const child = formatted[0].children?.[0];

  assertEqual(formatted[0].id, undefined, 'formatted root child id should be removed');
  assertEqual(formatted[0].parentId, undefined, 'formatted root child parentId should be removed');
  assertEqual(formatted[0].index, undefined, 'formatted root child index should be removed');
  assertEqual(formatted[0].dateAdded, undefined, 'formatted root child dateAdded should be removed');
  assertEqual(formatted[0].dateGroupModified, undefined, 'formatted root child dateGroupModified should be removed');
  assertEqual(formatted[0].type, undefined, 'formatted root child type should be removed');
  assertEqual(child?.id, undefined, 'formatted bookmark id should be removed');
  assertEqual(child?.parentId, undefined, 'formatted bookmark parentId should be removed');
  assertEqual(child?.dateAdded, undefined, 'formatted bookmark dateAdded should be removed');
  assertEqual(tree[0].children?.[0]?.id, '1', 'original tree should not be mutated');
  assertEqual(tree[0].children?.[0]?.children?.[0]?.id, 'bookmark-1', 'original child bookmark should not be mutated');
}

function rootNode(id: string, title: string): BookmarkInfo {
  return {
    id,
    parentId: '0',
    title,
    children: [
      new BookmarkInfo(`${title} Link`, `https://${id}.example`),
    ],
  };
}

function rootNodeWithCount(
  id: string,
  title: string,
  count: number,
  unmodifiable?: 'managed',
): BookmarkInfo {
  return {
    id,
    parentId: '0',
    title,
    unmodifiable,
    children: Array.from({ length: count }, (_, index) => (
      new BookmarkInfo(`${title} Link ${index + 1}`, `https://${id}-${index + 1}.example`)
    )),
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
