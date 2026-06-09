// SPDX-License-Identifier: Apache-2.0

import { BookmarkInfo, BrowserType, RootBookmarksType } from '../utils/models';

export interface BookmarkRootSummary {
  rootIndex: number;
  rootType: RootBookmarksType | 'Unknown';
  bookmarkCount: number;
  syncableBookmarkCount: number;
  urlSchemeCounts: BookmarkUrlSchemeCounts;
  syncableUrlSchemeCounts: BookmarkUrlSchemeCounts;
  syncable: boolean;
}

export interface BookmarkCountSummary {
  totalBookmarkCount: number;
  syncableBookmarkCount: number;
  skippedBookmarkCount: number;
  urlSchemeCounts: BookmarkUrlSchemeCounts;
  syncableUrlSchemeCounts: BookmarkUrlSchemeCounts;
  roots: BookmarkRootSummary[];
}

export interface BookmarkUrlSchemeCounts {
  total: number;
  web: number;
  browserInternal: number;
  other: number;
}

export async function getBookmarkTree() {
  const bookmarkTree: BookmarkInfo[] = await browser.bookmarks.getTree();
  return {
    bookmarkTree,
    browserType: detectBrowserType(bookmarkTree),
  };
}

export function detectBrowserType(bookmarkTree: BookmarkInfo[]) {
  return bookmarkTree?.[0]?.id === 'root________'
    ? BrowserType.FIREFOX
    : BrowserType.CHROME;
}

export async function clearBookmarkTree() {
  const { bookmarkTree } = await getBookmarkTree();
  const removableNodes: BookmarkInfo[] = [];

  bookmarkTree[0].children?.forEach(rootNode => {
    rootNode.children?.forEach(childNode => {
      removableNodes.push(childNode);
    });
  });

  for (const node of removableNodes) {
    if (node.id) {
      await browser.bookmarks.removeTree(node.id);
    }
  }
}

export async function createBookmarkTree(
  bookmarkList: BookmarkInfo[] | undefined,
  browserType: BrowserType,
) {
  if (!bookmarkList) {
    return;
  }

  for (const node of bookmarkList) {
    if (isRootBookmarkFolder(node)) {
      if (!isSyncableRoot(node.title as RootBookmarksType)) {
        continue;
      }

      assignRootParentIds(node, browserType);
      await createBookmarkTree(node.children, browserType);
      continue;
    }

    let createdNode: { id?: string; title?: string } = { id: '', title: '' };
    try {
      createdNode = await browser.bookmarks.create({
        parentId: node.parentId,
        title: node.title,
        url: node.url,
      });
    } catch (err) {
      console.error(createdNode, err);
    }

    if (createdNode.id && node.children && node.children.length > 0) {
      node.children.forEach(child => child.parentId = createdNode.id);
      await createBookmarkTree(node.children, browserType);
    }
  }
}

export function countBookmarks(bookmarkList: BookmarkInfo[] | undefined) {
  let count = 0;
  bookmarkList?.forEach(node => {
    if (node.url) {
      count += 1;
      return;
    }

    count += countBookmarks(node.children);
  });
  return count;
}

export function countSyncableBookmarks(bookmarks: BookmarkInfo[] | undefined) {
  return countBookmarks(formatBookmarksForSync(bookmarks || []));
}

export function summarizeBookmarkUrlSchemes(bookmarks: BookmarkInfo[] | undefined): BookmarkUrlSchemeCounts {
  const counts = emptyUrlSchemeCounts();
  countBookmarkUrlSchemes(bookmarks, counts);
  return counts;
}

export function filterSyncableBookmarkRoots(bookmarks: BookmarkInfo[] | undefined): BookmarkInfo[] {
  return (bookmarks || []).reduce<BookmarkInfo[]>((syncRoots, bookmark, index) => {
    const rootType = getSyncRootType(bookmark, index);
    if (!isSyncableRoot(rootType) || isManagedNode(bookmark)) {
      return syncRoots;
    }

    const syncRoot = cloneBookmark(bookmark);
    syncRoot.title = rootType;
    syncRoot.children = filterSyncableChildren(syncRoot.children);
    syncRoots.push(stripBrowserFields(syncRoot));
    return syncRoots;
  }, []);
}

export function summarizeBookmarkCounts(bookmarks: BookmarkInfo[] | undefined): BookmarkCountSummary {
  const roots = bookmarks?.[0]?.children || [];
  const rootSummaries = roots.map((root, index): BookmarkRootSummary => {
    const rootType = getSyncRootType(root, index);
    const bookmarkCount = countBookmarks([root]);
    const urlSchemeCounts = summarizeBookmarkUrlSchemes([root]);
    const syncable = isSyncableRoot(rootType) && !isManagedNode(root);
    const syncableChildren = syncable
      ? filterSyncableChildren(root.children)
      : [];
    const syncableBookmarkCount = syncable
      ? countBookmarks(syncableChildren)
      : 0;
    const syncableUrlSchemeCounts = syncable
      ? summarizeBookmarkUrlSchemes(syncableChildren)
      : emptyUrlSchemeCounts();

    return {
      rootIndex: index,
      rootType: rootType || 'Unknown',
      bookmarkCount,
      syncableBookmarkCount,
      urlSchemeCounts,
      syncableUrlSchemeCounts,
      syncable,
    };
  });
  const totalBookmarkCount = rootSummaries.reduce((sum, root) => sum + root.bookmarkCount, 0);
  const syncableBookmarkCount = rootSummaries.reduce((sum, root) => sum + root.syncableBookmarkCount, 0);
  const urlSchemeCounts = sumUrlSchemeCounts(rootSummaries.map(root => root.urlSchemeCounts));
  const syncableUrlSchemeCounts = sumUrlSchemeCounts(rootSummaries.map(root => root.syncableUrlSchemeCounts));

  return {
    totalBookmarkCount,
    syncableBookmarkCount,
    skippedBookmarkCount: totalBookmarkCount - syncableBookmarkCount,
    urlSchemeCounts,
    syncableUrlSchemeCounts,
    roots: rootSummaries,
  };
}

export function formatBookmarksForSync(bookmarks: BookmarkInfo[]) {
  if (!bookmarks[0]) {
    return [];
  }

  const root = cloneBookmark(bookmarks[0]);
  const syncRoots: BookmarkInfo[] = [];

  root.children?.forEach((child, index) => {
    if (isManagedNode(child)) {
      return;
    }

    const normalizedTitle = getSyncRootType(child, index);
    if (!isSyncableRoot(normalizedTitle)) {
      return;
    }

    child.title = normalizedTitle;
    child.children = filterSyncableChildren(child.children);
    syncRoots.push(child);
  });

  root.children = syncRoots;
  return stripBrowserFields(root).children;
}

function getNormalizedRootFolderTitle(node: BookmarkInfo, index: number) {
  switch (node.id) {
      case '1':
      case 'toolbar_____':
        return RootBookmarksType.ToolbarFolder;
      case 'menu________':
        return RootBookmarksType.MenuFolder;
      case '2':
      case 'unfiled_____':
        return RootBookmarksType.UnfiledFolder;
      case '3':
      case 'mobile______':
        return RootBookmarksType.MobileFolder;
  }

  return getRootFolderTitleFromBrowserLabel(node.title, index);
}

function getRootFolderTitleFromBrowserLabel(title: string, index: number) {
  const normalizedTitle = title.trim().toLowerCase();

  if ([
    'bookmarks bar',
    'favorites bar',
    '\u4e66\u7b7e\u680f',
    '\u6536\u85cf\u5939\u680f',
    '\u6536\u85cf\u680f',
  ].includes(normalizedTitle)) {
    return RootBookmarksType.ToolbarFolder;
  }

  if ([
    'bookmarks menu',
    'favorites menu',
    '\u4e66\u7b7e\u83dc\u5355',
    '\u6536\u85cf\u5939\u83dc\u5355',
  ].includes(normalizedTitle)) {
    return RootBookmarksType.MenuFolder;
  }

  if ([
    'other bookmarks',
    'other favorites',
    '\u5176\u4ed6\u4e66\u7b7e',
    '\u5176\u4ed6\u6536\u85cf\u5939',
  ].includes(normalizedTitle)) {
    return RootBookmarksType.UnfiledFolder;
  }

  if ([
    'mobile bookmarks',
    'mobile favorites',
    '\u79fb\u52a8\u4e66\u7b7e',
    '\u79fb\u52a8\u8bbe\u5907\u4e66\u7b7e',
    '\u79fb\u52a8\u6536\u85cf\u5939',
    '\u624b\u673a\u4e66\u7b7e',
  ].includes(normalizedTitle)) {
    return RootBookmarksType.MobileFolder;
  }

  if (!title && index === 0) {
    return RootBookmarksType.ToolbarFolder;
  }

  return undefined;
}

function isRootBookmarkFolder(node: BookmarkInfo) {
  return node.title === RootBookmarksType.MenuFolder
    || node.title === RootBookmarksType.MobileFolder
    || node.title === RootBookmarksType.ToolbarFolder
    || node.title === RootBookmarksType.UnfiledFolder;
}

function getSyncRootType(node: BookmarkInfo, index: number) {
  if (isRootBookmarkFolder(node)) {
    return node.title as RootBookmarksType;
  }

  return getNormalizedRootFolderTitle(node, index);
}

function isSyncableRoot(rootType: RootBookmarksType | undefined) {
  return rootType === RootBookmarksType.ToolbarFolder
    || rootType === RootBookmarksType.MenuFolder
    || rootType === RootBookmarksType.UnfiledFolder;
}

function assignRootParentIds(node: BookmarkInfo, browserType: BrowserType) {
  const parentId = getRootParentId(node.title as RootBookmarksType, browserType);
  node.children?.forEach(child => child.parentId = parentId);
}

function getRootParentId(title: RootBookmarksType, browserType: BrowserType) {
  if (browserType === BrowserType.FIREFOX) {
    switch (title) {
      case RootBookmarksType.MenuFolder:
        return 'menu________';
      case RootBookmarksType.MobileFolder:
        return 'mobile______';
      case RootBookmarksType.ToolbarFolder:
        return 'toolbar_____';
      case RootBookmarksType.UnfiledFolder:
      default:
        return 'unfiled_____';
    }
  }

  switch (title) {
    case RootBookmarksType.MobileFolder:
      return '3';
    case RootBookmarksType.ToolbarFolder:
      return '1';
    case RootBookmarksType.UnfiledFolder:
    case RootBookmarksType.MenuFolder:
    default:
      return '2';
  }
}

function stripBrowserFields(bookmark: BookmarkInfo): BookmarkInfo {
  bookmark.dateAdded = undefined;
  bookmark.dateGroupModified = undefined;
  bookmark.id = undefined;
  bookmark.index = undefined;
  bookmark.parentId = undefined;
  bookmark.type = undefined;
  bookmark.unmodifiable = undefined;

  bookmark.children?.forEach(child => stripBrowserFields(child));
  return bookmark;
}

function filterSyncableChildren(children: BookmarkInfo[] | undefined): BookmarkInfo[] {
  return (children || [])
    .filter(child => !isManagedNode(child) && child.type !== 'separator')
    .map(child => {
      const nextChild = cloneBookmark(child);
      nextChild.children = nextChild.children
        ? filterSyncableChildren(nextChild.children)
        : nextChild.children;
      return nextChild;
    });
}

function isManagedNode(bookmark: BookmarkInfo) {
  return bookmark.unmodifiable === 'managed';
}

function cloneBookmark(bookmark: BookmarkInfo): BookmarkInfo {
  return JSON.parse(JSON.stringify(bookmark));
}

function countBookmarkUrlSchemes(
  bookmarks: BookmarkInfo[] | undefined,
  counts: BookmarkUrlSchemeCounts,
) {
  bookmarks?.forEach(node => {
    if (node.url) {
      counts.total += 1;
      const category = getUrlSchemeCategory(node.url);
      counts[category] += 1;
      return;
    }

    countBookmarkUrlSchemes(node.children, counts);
  });
}

function getUrlSchemeCategory(url: string): keyof Omit<BookmarkUrlSchemeCounts, 'total'> {
  const scheme = getUrlScheme(url);
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

function getUrlScheme(url: string) {
  return (/^([^:\s]+):/.exec(url)?.[1] || '').toLowerCase();
}

function emptyUrlSchemeCounts(): BookmarkUrlSchemeCounts {
  return {
    total: 0,
    web: 0,
    browserInternal: 0,
    other: 0,
  };
}

function sumUrlSchemeCounts(counts: BookmarkUrlSchemeCounts[]): BookmarkUrlSchemeCounts {
  return counts.reduce((sum, count) => ({
    total: sum.total + count.total,
    web: sum.web + count.web,
    browserInternal: sum.browserInternal + count.browserInternal,
    other: sum.other + count.other,
  }), emptyUrlSchemeCounts());
}
