// SPDX-License-Identifier: Apache-2.0

import { BookmarkInfo, RootBookmarksType } from '../utils/models';

export interface BookmarkMergeSummary {
  addedRemoteBookmarks: number;
  addedRemoteFolders: number;
  addedLocalBookmarks: number;
  addedLocalFolders: number;
  removedBaseBookmarks: number;
  removedBaseFolders: number;
  mergedFolders: number;
  skippedDuplicateBookmarks: number;
  skippedDuplicateFolders: number;
  ambiguousFolderGroups: number;
  usedBaseline: boolean;
}

export interface BookmarkMergeResult {
  bookmarks: BookmarkInfo[];
  summary: BookmarkMergeSummary;
}

const ROOT_ORDER = [
  RootBookmarksType.ToolbarFolder,
  RootBookmarksType.MenuFolder,
  RootBookmarksType.UnfiledFolder,
  RootBookmarksType.MobileFolder,
];

export function mergeBookmarksConservatively(
  localBookmarks: BookmarkInfo[] | undefined,
  remoteBookmarks: BookmarkInfo[] | undefined,
): BookmarkMergeResult {
  const summary = createEmptySummary();
  const localRoots = (localBookmarks || []).map(sanitizeBookmarkNode);
  const remoteRoots = (remoteBookmarks || []).map(sanitizeBookmarkNode);
  const mergedRoots: BookmarkInfo[] = [];

  for (const rootTitle of ROOT_ORDER) {
    const localRoot = findRoot(localRoots, rootTitle);
    const remoteRoot = findRoot(remoteRoots, rootTitle);

    if (localRoot && remoteRoot) {
      mergedRoots.push(mergeFolder(localRoot, remoteRoot, summary));
      continue;
    }

    if (localRoot) {
      mergedRoots.push(localRoot);
      continue;
    }

    if (remoteRoot) {
      mergedRoots.push(remoteRoot);
      summary.addedRemoteFolders += 1;
    }
  }

  for (const localRoot of localRoots) {
    if (!mergedRoots.some(root => root.title === localRoot.title)) {
      mergedRoots.push(localRoot);
    }
  }

  for (const remoteRoot of remoteRoots) {
    if (!mergedRoots.some(root => root.title === remoteRoot.title)) {
      mergedRoots.push(remoteRoot);
      summary.addedRemoteFolders += 1;
    }
  }

  return {
    bookmarks: mergedRoots,
    summary,
  };
}

export function mergeBookmarksWithBase(
  baseBookmarks: BookmarkInfo[] | undefined,
  localBookmarks: BookmarkInfo[] | undefined,
  remoteBookmarks: BookmarkInfo[] | undefined,
): BookmarkMergeResult {
  if (!baseBookmarks) {
    return mergeBookmarksConservatively(localBookmarks, remoteBookmarks);
  }

  const summary = createEmptySummary();
  summary.usedBaseline = true;
  const baseRoots = (baseBookmarks || []).map(sanitizeBookmarkNode);
  const localRoots = (localBookmarks || []).map(sanitizeBookmarkNode);
  const remoteRoots = (remoteBookmarks || []).map(sanitizeBookmarkNode);
  const mergedRoots: BookmarkInfo[] = [];

  for (const rootTitle of ROOT_ORDER) {
    const baseRoot = findRoot(baseRoots, rootTitle);
    const localRoot = findRoot(localRoots, rootTitle);
    const remoteRoot = findRoot(remoteRoots, rootTitle);

    if (baseRoot || localRoot || remoteRoot) {
      mergedRoots.push(mergeRootWithBase(rootTitle, baseRoot, localRoot, remoteRoot, summary));
    }
  }

  appendNonStandardRoots(mergedRoots, baseRoots, localRoots, remoteRoots, summary);

  return {
    bookmarks: mergedRoots,
    summary,
  };
}

export function createMergeHistoryMessage(summary: BookmarkMergeSummary) {
  const parts = [
    'Auto merged local and remote bookmark changes',
    summary.usedBaseline ? 'used previous sync baseline' : 'used conservative no-delete merge',
    `added ${summary.addedLocalBookmarks} local bookmark(s)`,
    `added ${summary.addedRemoteBookmarks} remote bookmark(s)`,
    `added ${summary.addedLocalFolders} local folder(s)`,
    `added ${summary.addedRemoteFolders} remote folder(s)`,
    `accepted ${summary.removedBaseBookmarks} deleted bookmark(s)`,
    `accepted ${summary.removedBaseFolders} deleted folder(s)`,
    `merged ${summary.mergedFolders} matching folder(s)`,
    `skipped ${summary.skippedDuplicateBookmarks} duplicate bookmark(s)`,
    `skipped ${summary.skippedDuplicateFolders} duplicate folder(s)`,
    `left ${summary.ambiguousFolderGroups} ambiguous folder group(s) uncollapsed`,
  ];

  return parts.join('; ');
}

function mergeRootWithBase(
  rootTitle: RootBookmarksType,
  baseRoot: BookmarkInfo | undefined,
  localRoot: BookmarkInfo | undefined,
  remoteRoot: BookmarkInfo | undefined,
  summary: BookmarkMergeSummary,
) {
  return {
    title: rootTitle,
    children: mergeChildrenWithBase(baseRoot?.children, localRoot?.children, remoteRoot?.children, summary),
  };
}

function mergeChildrenWithBase(
  baseChildren: BookmarkInfo[] | undefined,
  localChildren: BookmarkInfo[] | undefined,
  remoteChildren: BookmarkInfo[] | undefined,
  summary: BookmarkMergeSummary,
) {
  const result: BookmarkInfo[] = [];
  const baseNodes = (baseChildren || []).map(sanitizeBookmarkNode);
  const localNodes = (localChildren || []).map(sanitizeBookmarkNode);
  const remoteNodes = (remoteChildren || []).map(sanitizeBookmarkNode);

  mergeBookmarksWithBaseIntoResult(result, baseNodes, localNodes, remoteNodes, summary);
  mergeFoldersWithBaseIntoResult(result, baseNodes, localNodes, remoteNodes, summary);

  return result;
}

function mergeBookmarksWithBaseIntoResult(
  result: BookmarkInfo[],
  baseNodes: BookmarkInfo[],
  localNodes: BookmarkInfo[],
  remoteNodes: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const baseBookmarks = mapBookmarksByKey(baseNodes.filter(isBookmark));
  const localBookmarks = mapBookmarksByKey(localNodes.filter(isBookmark));
  const remoteBookmarks = mapBookmarksByKey(remoteNodes.filter(isBookmark));
  const allKeys = new Set([
    ...baseBookmarks.keys(),
    ...localBookmarks.keys(),
    ...remoteBookmarks.keys(),
  ]);

  for (const key of allKeys) {
    const baseBookmark = baseBookmarks.get(key);
    const localBookmark = localBookmarks.get(key);
    const remoteBookmark = remoteBookmarks.get(key);

    if (localBookmark && remoteBookmark) {
      addBookmarkIfMissing(result, localBookmark, summary);
      continue;
    }

    if (!baseBookmark) {
      if (localBookmark) {
        addBookmarkIfMissing(result, localBookmark, summary, 'local');
      }
      if (remoteBookmark) {
        addBookmarkIfMissing(result, remoteBookmark, summary, 'remote');
      }
      continue;
    }

    if (localBookmark || remoteBookmark) {
      summary.removedBaseBookmarks += 1;
    }
  }
}

function mergeFoldersWithBaseIntoResult(
  result: BookmarkInfo[],
  baseNodes: BookmarkInfo[],
  localNodes: BookmarkInfo[],
  remoteNodes: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const baseGroups = groupFoldersByTitle(baseNodes.filter(isFolder));
  const localGroups = groupFoldersByTitle(localNodes.filter(isFolder));
  const remoteGroups = groupFoldersByTitle(remoteNodes.filter(isFolder));
  const allTitles = new Set([
    ...baseGroups.keys(),
    ...localGroups.keys(),
    ...remoteGroups.keys(),
  ]);

  for (const title of allTitles) {
    const baseGroup = baseGroups.get(title) || [];
    const localGroup = localGroups.get(title) || [];
    const remoteGroup = remoteGroups.get(title) || [];

    if (baseGroup.length <= 1 && localGroup.length <= 1 && remoteGroup.length <= 1) {
      mergeUniqueFolderGroup(result, baseGroup[0], localGroup[0], remoteGroup[0], summary);
      continue;
    }

    summary.ambiguousFolderGroups += 1;
    mergeAmbiguousFolderGroup(result, baseGroup, localGroup, remoteGroup, summary);
  }
}

function mergeUniqueFolderGroup(
  result: BookmarkInfo[],
  baseFolder: BookmarkInfo | undefined,
  localFolder: BookmarkInfo | undefined,
  remoteFolder: BookmarkInfo | undefined,
  summary: BookmarkMergeSummary,
) {
  if (localFolder && remoteFolder) {
    result.push({
      title: localFolder.title || remoteFolder.title,
      children: mergeChildrenWithBase(baseFolder?.children, localFolder.children, remoteFolder.children, summary),
    });
    summary.mergedFolders += 1;
    return;
  }

  if (!baseFolder) {
    if (localFolder) {
      result.push(localFolder);
      summary.addedLocalFolders += 1;
    }
    if (remoteFolder) {
      result.push(remoteFolder);
      summary.addedRemoteFolders += 1;
    }
    return;
  }

  if (localFolder && !remoteFolder) {
    if (createFolderSignature(localFolder) === createFolderSignature(baseFolder)) {
      summary.removedBaseFolders += 1;
      return;
    }

    result.push(localFolder);
    return;
  }

  if (remoteFolder && !localFolder) {
    if (createFolderSignature(remoteFolder) === createFolderSignature(baseFolder)) {
      summary.removedBaseFolders += 1;
      return;
    }

    result.push(remoteFolder);
  }
}

function mergeAmbiguousFolderGroup(
  result: BookmarkInfo[],
  baseGroup: BookmarkInfo[],
  localGroup: BookmarkInfo[],
  remoteGroup: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const baseSignatures = new Set(baseGroup.map(createFolderSignature));

  for (const localFolder of localGroup) {
    const localSignature = createFolderSignature(localFolder);
    const remoteHasExactFolder = remoteGroup.some(remoteFolder => createFolderSignature(remoteFolder) === localSignature);
    if (remoteHasExactFolder || !baseSignatures.has(localSignature)) {
      addFolderIfMissing(result, localFolder, summary, baseSignatures.has(localSignature) ? undefined : 'local');
    }
  }

  for (const remoteFolder of remoteGroup) {
    const remoteSignature = createFolderSignature(remoteFolder);
    const localHasExactFolder = localGroup.some(localFolder => createFolderSignature(localFolder) === remoteSignature);
    if (localHasExactFolder) {
      continue;
    }

    if (baseSignatures.has(remoteSignature)) {
      continue;
    }

    addFolderIfMissing(result, remoteFolder, summary, 'remote');
  }
}

function mergeFolder(
  localFolder: BookmarkInfo,
  remoteFolder: BookmarkInfo,
  summary: BookmarkMergeSummary,
): BookmarkInfo {
  summary.mergedFolders += 1;
  return {
    title: localFolder.title || remoteFolder.title,
    children: mergeChildren(localFolder.children, remoteFolder.children, summary),
  };
}

function mergeChildren(
  localChildren: BookmarkInfo[] | undefined,
  remoteChildren: BookmarkInfo[] | undefined,
  summary: BookmarkMergeSummary,
) {
  const result = (localChildren || []).map(sanitizeBookmarkNode);
  const remoteNodes = (remoteChildren || []).map(sanitizeBookmarkNode);

  mergeRemoteBookmarks(result, remoteNodes, summary);
  mergeRemoteFolders(result, remoteNodes, summary);

  return result;
}

function mergeRemoteBookmarks(
  result: BookmarkInfo[],
  remoteNodes: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const existingBookmarkKeys = new Set(
    result.filter(isBookmark).map(createBookmarkKey),
  );

  for (const remoteBookmark of remoteNodes.filter(isBookmark)) {
    const key = createBookmarkKey(remoteBookmark);
    if (existingBookmarkKeys.has(key)) {
      summary.skippedDuplicateBookmarks += 1;
      continue;
    }

    result.push(remoteBookmark);
    existingBookmarkKeys.add(key);
    summary.addedRemoteBookmarks += 1;
  }
}

function addBookmarkIfMissing(
  result: BookmarkInfo[],
  bookmark: BookmarkInfo,
  summary: BookmarkMergeSummary,
  source?: 'local' | 'remote',
) {
  const key = createBookmarkKey(bookmark);
  const hasBookmark = result.filter(isBookmark).some(existing => createBookmarkKey(existing) === key);

  if (hasBookmark) {
    summary.skippedDuplicateBookmarks += 1;
    return;
  }

  result.push(bookmark);
  if (source === 'local') {
    summary.addedLocalBookmarks += 1;
  } else if (source === 'remote') {
    summary.addedRemoteBookmarks += 1;
  }
}

function mergeRemoteFolders(
  result: BookmarkInfo[],
  remoteNodes: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const resultFolders = result.filter(isFolder);
  const remoteFolders = remoteNodes.filter(isFolder);
  const localFolderGroups = groupFoldersByTitle(resultFolders);
  const remoteFolderGroups = groupFoldersByTitle(remoteFolders);

  for (const [title, remoteGroup] of remoteFolderGroups) {
    const localGroup = localFolderGroups.get(title) || [];

    if (localGroup.length === 1 && remoteGroup.length === 1) {
      const localFolder = localGroup[0];
      const mergedFolder = mergeFolder(localFolder, remoteGroup[0], summary);
      result[result.indexOf(localFolder)] = mergedFolder;
      continue;
    }

    if (localGroup.length > 0 || remoteGroup.length > 1) {
      summary.ambiguousFolderGroups += 1;
    }

    for (const remoteFolder of remoteGroup) {
      addRemoteFolderIfMissing(result, remoteFolder, summary);
    }
  }
}

function addRemoteFolderIfMissing(
  result: BookmarkInfo[],
  remoteFolder: BookmarkInfo,
  summary: BookmarkMergeSummary,
) {
  const remoteSignature = createFolderSignature(remoteFolder);
  const hasExactFolder = result
    .filter(isFolder)
    .some(folder => createFolderSignature(folder) === remoteSignature);

  if (hasExactFolder) {
    summary.skippedDuplicateFolders += 1;
    return;
  }

  result.push(remoteFolder);
  summary.addedRemoteFolders += 1;
}

function addFolderIfMissing(
  result: BookmarkInfo[],
  folder: BookmarkInfo,
  summary: BookmarkMergeSummary,
  source?: 'local' | 'remote',
) {
  const signature = createFolderSignature(folder);
  const hasExactFolder = result
    .filter(isFolder)
    .some(existing => createFolderSignature(existing) === signature);

  if (hasExactFolder) {
    summary.skippedDuplicateFolders += 1;
    return;
  }

  result.push(folder);
  if (source === 'local') {
    summary.addedLocalFolders += 1;
  } else if (source === 'remote') {
    summary.addedRemoteFolders += 1;
  }
}

function appendNonStandardRoots(
  mergedRoots: BookmarkInfo[],
  baseRoots: BookmarkInfo[],
  localRoots: BookmarkInfo[],
  remoteRoots: BookmarkInfo[],
  summary: BookmarkMergeSummary,
) {
  const standardRootTitles = new Set<string>(ROOT_ORDER);
  const baseExtraRoots = baseRoots.filter(root => !standardRootTitles.has(root.title));
  const localExtraRoots = localRoots.filter(root => !standardRootTitles.has(root.title));
  const remoteExtraRoots = remoteRoots.filter(root => !standardRootTitles.has(root.title));
  mergeFoldersWithBaseIntoResult(mergedRoots, baseExtraRoots, localExtraRoots, remoteExtraRoots, summary);
}

function findRoot(bookmarks: BookmarkInfo[], title: RootBookmarksType) {
  return bookmarks.find(bookmark => bookmark.title === title);
}

function groupFoldersByTitle(folders: BookmarkInfo[]) {
  const groups = new Map<string, BookmarkInfo[]>();
  for (const folder of folders) {
    const key = folder.title || '';
    groups.set(key, [...(groups.get(key) || []), folder]);
  }
  return groups;
}

function createBookmarkKey(bookmark: BookmarkInfo) {
  return `${bookmark.title || ''}\n${bookmark.url || ''}`;
}

function mapBookmarksByKey(bookmarks: BookmarkInfo[]) {
  const map = new Map<string, BookmarkInfo>();
  for (const bookmark of bookmarks) {
    map.set(createBookmarkKey(bookmark), bookmark);
  }
  return map;
}

function createFolderSignature(folder: BookmarkInfo): string {
  return JSON.stringify({
    title: folder.title || '',
    children: (folder.children || []).map(child => isBookmark(child)
      ? { title: child.title || '', url: child.url || '' }
      : { title: child.title || '', children: createFolderSignature(child) }),
  });
}

function sanitizeBookmarkNode(node: BookmarkInfo): BookmarkInfo {
  const sanitized: BookmarkInfo = {
    title: node.title || '',
  };

  if (node.url) {
    sanitized.url = node.url;
  }

  if (node.children) {
    sanitized.children = node.children.map(sanitizeBookmarkNode);
  }

  return sanitized;
}

function isBookmark(node: BookmarkInfo) {
  return Boolean(node.url);
}

function isFolder(node: BookmarkInfo) {
  return !node.url;
}

function createEmptySummary(): BookmarkMergeSummary {
  return {
    addedRemoteBookmarks: 0,
    addedRemoteFolders: 0,
    addedLocalBookmarks: 0,
    addedLocalFolders: 0,
    removedBaseBookmarks: 0,
    removedBaseFolders: 0,
    mergedFolders: 0,
    skippedDuplicateBookmarks: 0,
    skippedDuplicateFolders: 0,
    ambiguousFolderGroups: 0,
    usedBaseline: false,
  };
}
