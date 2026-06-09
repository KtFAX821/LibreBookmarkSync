// SPDX-License-Identifier: Apache-2.0

import { mergeBookmarksWithBase } from '../src/sync/bookmarkMerge';
import { BookmarkInfo, RootBookmarksType } from '../src/utils/models';

runTests();

function runTests() {
  keepsBothLocalAndRemoteAdditions();
  acceptsOneSidedBookmarkDeletionWhenOtherSideIsUnchanged();
  keepsChangedFolderWhenOtherSideDeletedTheBaselineFolder();
  fallsBackToNoDeleteMergeWhenBaselineIsMissing();
  keepsMovedBookmarkWhenRemoteSideIsUnchanged();
  keepsCrossRootMovedBookmarkWhenRemoteSideIsUnchanged();
  preservesMoveWhenRemoteChangedTheOriginalFolder();
  preservesBothDestinationsWhenBothSidesMoveTheSameBookmark();
  keepsLocalBookmarkTitleEditWhenRemoteSideIsUnchanged();
  keepsRemoteBookmarkTitleEditWhenLocalSideIsUnchanged();
  keepsLocalBookmarkUrlEditWhenRemoteSideIsUnchanged();
  keepsRemoteBookmarkUrlEditWhenLocalSideIsUnchanged();
  preservesBothBookmarkTitleEditsWhenBothSidesChanged();
  preservesBothBookmarkUrlEditsWhenBothSidesChanged();
  keepsLocalFolderRenameWhenRemoteSideIsUnchanged();
  keepsRemoteFolderRenameWhenLocalSideIsUnchanged();
  keepsBothRenamedAndRemotelyChangedFolders();
  preservesAmbiguousDuplicateSameTitleFolders();
  preservesNestedDuplicateFolderEdits();
  preservesMovedBookmarkWhenRemoteEditedTheBookmark();
  mergesNestedFolderConflictsWithoutDroppingEitherSide();
  console.log('bookmarkMerge tests passed');
}

function keepsBothLocalAndRemoteAdditions() {
  const base = tree([
    bookmark('Base', 'https://example.com/base'),
  ]);
  const local = tree([
    bookmark('Base', 'https://example.com/base'),
    bookmark('Local', 'https://example.com/local'),
  ]);
  const remote = tree([
    bookmark('Base', 'https://example.com/base'),
    bookmark('Remote', 'https://example.com/remote'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const bookmarks = toolbarBookmarkTitles(result.bookmarks);

  assertEqual(result.summary.usedBaseline, true, 'baseline should be used');
  assertEqual(result.summary.addedLocalBookmarks, 1, 'local addition should be counted');
  assertEqual(result.summary.addedRemoteBookmarks, 1, 'remote addition should be counted');
  assertIncludes(bookmarks, 'Base', 'base bookmark should remain');
  assertIncludes(bookmarks, 'Local', 'local bookmark should remain');
  assertIncludes(bookmarks, 'Remote', 'remote bookmark should remain');
}

function acceptsOneSidedBookmarkDeletionWhenOtherSideIsUnchanged() {
  const base = tree([
    bookmark('Keep', 'https://example.com/keep'),
    bookmark('Delete Me', 'https://example.com/delete-me'),
  ]);
  const local = tree([
    bookmark('Keep', 'https://example.com/keep'),
  ]);
  const remote = tree([
    bookmark('Keep', 'https://example.com/keep'),
    bookmark('Delete Me', 'https://example.com/delete-me'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const bookmarks = toolbarBookmarkTitles(result.bookmarks);

  assertEqual(result.summary.removedBaseBookmarks, 1, 'one-sided deletion should be accepted');
  assertIncludes(bookmarks, 'Keep', 'unchanged bookmark should remain');
  assertNotIncludes(bookmarks, 'Delete Me', 'deleted bookmark should not return');
}

function keepsChangedFolderWhenOtherSideDeletedTheBaselineFolder() {
  const base = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/base'),
    ]),
  ]);
  const local = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/base'),
      bookmark('Local Note', 'https://example.com/local-note'),
    ]),
  ]);
  const remote = tree([]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const project = toolbarChildren(result.bookmarks).find(node => node.title === 'Project');

  assert(Boolean(project), 'changed folder should be preserved');
  assertEqual(result.summary.removedBaseFolders, 0, 'changed folder should not be counted as accepted deletion');
  assertIncludes(
    (project?.children || []).map(node => node.title),
    'Local Note',
    'changed folder content should remain',
  );
}

function fallsBackToNoDeleteMergeWhenBaselineIsMissing() {
  const local = tree([
    bookmark('Local', 'https://example.com/local'),
  ]);
  const remote = tree([
    bookmark('Remote', 'https://example.com/remote'),
  ]);

  const result = mergeBookmarksWithBase(undefined, local, remote);
  const bookmarks = toolbarBookmarkTitles(result.bookmarks);

  assertEqual(result.summary.usedBaseline, false, 'missing baseline should use conservative merge');
  assertIncludes(bookmarks, 'Local', 'local bookmark should remain without baseline');
  assertIncludes(bookmarks, 'Remote', 'remote bookmark should remain without baseline');
}

function keepsMovedBookmarkWhenRemoteSideIsUnchanged() {
  const base = tree([
    folder('Old Folder', [
      bookmark('Moved', 'https://example.com/moved'),
    ]),
  ]);
  const local = tree([
    folder('New Folder', [
      bookmark('Moved', 'https://example.com/moved'),
    ]),
  ]);
  const remote = tree([
    folder('Old Folder', [
      bookmark('Moved', 'https://example.com/moved'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const movedBookmarks = findBookmarksByUrl(result.bookmarks, 'https://example.com/moved');
  const newFolder = findToolbarFolder(result.bookmarks, 'New Folder');

  assertEqual(movedBookmarks.length, 1, 'moved bookmark should not be duplicated');
  assert(Boolean(newFolder), 'new folder should remain after move');
  assertIncludes(
    (newFolder?.children || []).map(node => node.title),
    'Moved',
    'moved bookmark should stay in new folder',
  );
}

function keepsCrossRootMovedBookmarkWhenRemoteSideIsUnchanged() {
  const base = tree([
    bookmark('Moved Across Roots', 'https://example.com/cross-root'),
  ]);
  const local = tree(
    [],
    [
      bookmark('Moved Across Roots', 'https://example.com/cross-root'),
    ],
  );
  const remote = tree([
    bookmark('Moved Across Roots', 'https://example.com/cross-root'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/cross-root').length,
    1,
    'cross-root moved bookmark should not be duplicated',
  );
  assertNotIncludes(
    rootBookmarkTitles(result.bookmarks, RootBookmarksType.ToolbarFolder),
    'Moved Across Roots',
    'old root should not keep moved bookmark',
  );
  assertIncludes(
    rootBookmarkTitles(result.bookmarks, RootBookmarksType.MenuFolder),
    'Moved Across Roots',
    'new root should keep moved bookmark',
  );
}

function preservesMoveWhenRemoteChangedTheOriginalFolder() {
  const base = tree([
    folder('Old Folder', [
      bookmark('Moved With Conflict', 'https://example.com/moved-conflict'),
    ]),
  ]);
  const local = tree([
    folder('New Folder', [
      bookmark('Moved With Conflict', 'https://example.com/moved-conflict'),
    ]),
  ]);
  const remote = tree([
    folder('Old Folder', [
      bookmark('Moved With Conflict', 'https://example.com/moved-conflict'),
      bookmark('Remote Addition', 'https://example.com/remote-addition'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const oldFolder = findToolbarFolder(result.bookmarks, 'Old Folder');
  const newFolder = findToolbarFolder(result.bookmarks, 'New Folder');

  assert(Boolean(oldFolder), 'changed original folder should remain during move conflict');
  assert(Boolean(newFolder), 'local move destination should remain during move conflict');
  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/moved-conflict').length,
    2,
    'ambiguous move conflict should preserve both bookmark locations',
  );
  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-addition').length,
    1,
    'remote addition in original folder should remain',
  );
}

function preservesBothDestinationsWhenBothSidesMoveTheSameBookmark() {
  const base = tree([
    folder('Original Folder', [
      bookmark('Moved On Both Sides', 'https://example.com/both-moved'),
    ]),
  ]);
  const local = tree([
    folder('Local Destination', [
      bookmark('Moved On Both Sides', 'https://example.com/both-moved'),
    ]),
  ]);
  const remote = tree([
    folder('Remote Destination', [
      bookmark('Moved On Both Sides', 'https://example.com/both-moved'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assert(!findToolbarFolder(result.bookmarks, 'Original Folder'), 'unchanged original folder should not return');
  assert(Boolean(findToolbarFolder(result.bookmarks, 'Local Destination')), 'local move destination should remain');
  assert(Boolean(findToolbarFolder(result.bookmarks, 'Remote Destination')), 'remote move destination should remain');
  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/both-moved').length,
    2,
    'different move destinations should be preserved instead of guessed',
  );
}

function keepsLocalBookmarkTitleEditWhenRemoteSideIsUnchanged() {
  const base = tree([
    bookmark('Original Title', 'https://example.com/title-edit'),
  ]);
  const local = tree([
    bookmark('Edited Title', 'https://example.com/title-edit'),
  ]);
  const remote = tree([
    bookmark('Original Title', 'https://example.com/title-edit'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const titles = toolbarBookmarkTitles(result.bookmarks);

  assertEqual(result.summary.addedLocalBookmarks, 1, 'local title edit should be counted as a local bookmark addition');
  assertEqual(result.summary.removedBaseBookmarks, 1, 'unchanged remote bookmark should be replaced by local title edit');
  assertIncludes(titles, 'Edited Title', 'edited title should remain');
  assertNotIncludes(titles, 'Original Title', 'unchanged old title should not return');
}

function keepsRemoteBookmarkTitleEditWhenLocalSideIsUnchanged() {
  const base = tree([
    bookmark('Original Title', 'https://example.com/remote-title-edit'),
  ]);
  const local = tree([
    bookmark('Original Title', 'https://example.com/remote-title-edit'),
  ]);
  const remote = tree([
    bookmark('Remote Edited Title', 'https://example.com/remote-title-edit'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const titles = toolbarBookmarkTitles(result.bookmarks);

  assertEqual(result.summary.addedRemoteBookmarks, 1, 'remote title edit should be counted as a remote bookmark addition');
  assertEqual(result.summary.removedBaseBookmarks, 1, 'unchanged local bookmark should be replaced by remote title edit');
  assertIncludes(titles, 'Remote Edited Title', 'remote edited title should remain');
  assertNotIncludes(titles, 'Original Title', 'unchanged old title should not return');
}

function keepsLocalBookmarkUrlEditWhenRemoteSideIsUnchanged() {
  const base = tree([
    bookmark('URL Edit', 'https://example.com/original-local-url'),
  ]);
  const local = tree([
    bookmark('URL Edit', 'https://example.com/local-url-edit'),
  ]);
  const remote = tree([
    bookmark('URL Edit', 'https://example.com/original-local-url'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assertEqual(result.summary.addedLocalBookmarks, 1, 'local URL edit should be counted as a local bookmark addition');
  assertEqual(result.summary.removedBaseBookmarks, 1, 'unchanged remote bookmark should be replaced by local URL edit');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/local-url-edit').length, 1, 'local edited URL should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/original-local-url').length, 0, 'unchanged old URL should not return');
}

function keepsRemoteBookmarkUrlEditWhenLocalSideIsUnchanged() {
  const base = tree([
    bookmark('URL Edit', 'https://example.com/original-remote-url'),
  ]);
  const local = tree([
    bookmark('URL Edit', 'https://example.com/original-remote-url'),
  ]);
  const remote = tree([
    bookmark('URL Edit', 'https://example.com/remote-url-edit'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assertEqual(result.summary.addedRemoteBookmarks, 1, 'remote URL edit should be counted as a remote bookmark addition');
  assertEqual(result.summary.removedBaseBookmarks, 1, 'unchanged local bookmark should be replaced by remote URL edit');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-url-edit').length, 1, 'remote edited URL should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/original-remote-url').length, 0, 'unchanged old URL should not return');
}

function preservesBothBookmarkTitleEditsWhenBothSidesChanged() {
  const base = tree([
    bookmark('Original Title', 'https://example.com/title-conflict'),
  ]);
  const local = tree([
    bookmark('Local Title', 'https://example.com/title-conflict'),
  ]);
  const remote = tree([
    bookmark('Remote Title', 'https://example.com/title-conflict'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const titles = toolbarBookmarkTitles(result.bookmarks);

  assertIncludes(titles, 'Local Title', 'local title edit should remain');
  assertIncludes(titles, 'Remote Title', 'remote title edit should remain');
  assertNotIncludes(titles, 'Original Title', 'baseline title should not be restored during conflict');
}

function preservesBothBookmarkUrlEditsWhenBothSidesChanged() {
  const base = tree([
    bookmark('URL Edit', 'https://example.com/original'),
  ]);
  const local = tree([
    bookmark('URL Edit', 'https://example.com/local-url'),
  ]);
  const remote = tree([
    bookmark('URL Edit', 'https://example.com/remote-url'),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/local-url').length, 1, 'local URL edit should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-url').length, 1, 'remote URL edit should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/original').length, 0, 'baseline URL should not be restored during conflict');
}

function keepsLocalFolderRenameWhenRemoteSideIsUnchanged() {
  const base = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/local-folder-rename'),
    ]),
  ]);
  const local = tree([
    folder('Renamed Project', [
      bookmark('Base', 'https://example.com/local-folder-rename'),
    ]),
  ]);
  const remote = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/local-folder-rename'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assert(Boolean(findToolbarFolder(result.bookmarks, 'Renamed Project')), 'local renamed folder should remain');
  assert(!findToolbarFolder(result.bookmarks, 'Project'), 'unchanged old folder name should not return');
  assertEqual(result.summary.addedLocalFolders, 1, 'local folder rename should be counted as a local folder addition');
  assertEqual(result.summary.removedBaseFolders, 1, 'unchanged remote folder should be replaced by local rename');
}

function keepsRemoteFolderRenameWhenLocalSideIsUnchanged() {
  const base = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/remote-folder-rename'),
    ]),
  ]);
  const local = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/remote-folder-rename'),
    ]),
  ]);
  const remote = tree([
    folder('Renamed Project', [
      bookmark('Base', 'https://example.com/remote-folder-rename'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assert(Boolean(findToolbarFolder(result.bookmarks, 'Renamed Project')), 'remote renamed folder should remain');
  assert(!findToolbarFolder(result.bookmarks, 'Project'), 'unchanged old folder name should not return');
  assertEqual(result.summary.addedRemoteFolders, 1, 'remote folder rename should be counted as a remote folder addition');
  assertEqual(result.summary.removedBaseFolders, 1, 'unchanged local folder should be replaced by remote rename');
}

function keepsBothRenamedAndRemotelyChangedFolders() {
  const base = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/base'),
    ]),
  ]);
  const local = tree([
    folder('Renamed Project', [
      bookmark('Base', 'https://example.com/base'),
    ]),
  ]);
  const remote = tree([
    folder('Project', [
      bookmark('Base', 'https://example.com/base'),
      bookmark('Remote Note', 'https://example.com/remote-note'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assert(Boolean(findToolbarFolder(result.bookmarks, 'Renamed Project')), 'renamed local folder should remain');
  assert(Boolean(findToolbarFolder(result.bookmarks, 'Project')), 'remotely changed original folder should remain');
  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-note').length,
    1,
    'remote folder change should not be dropped during rename conflict',
  );
}

function preservesAmbiguousDuplicateSameTitleFolders() {
  const base = tree([
    folder('Project', [
      bookmark('Alpha', 'https://example.com/alpha'),
    ]),
    folder('Project', [
      bookmark('Beta', 'https://example.com/beta'),
    ]),
  ]);
  const local = tree([
    folder('Project', [
      bookmark('Alpha', 'https://example.com/alpha'),
    ]),
    folder('Project', [
      bookmark('Beta', 'https://example.com/beta'),
    ]),
  ]);
  const remote = tree([
    folder('Project', [
      bookmark('Alpha', 'https://example.com/alpha'),
      bookmark('Remote Alpha', 'https://example.com/remote-alpha'),
    ]),
    folder('Project', [
      bookmark('Beta', 'https://example.com/beta'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const projectFolders = toolbarChildren(result.bookmarks).filter(node => node.title === 'Project');

  assertEqual(result.summary.ambiguousFolderGroups, 1, 'duplicate same-title folders should be marked ambiguous');
  assertEqual(projectFolders.length, 2, 'ambiguous same-title folders should remain separate');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/alpha').length, 1, 'alpha bookmark should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/beta').length, 1, 'beta bookmark should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-alpha').length, 1, 'remote change should remain');
}

function preservesNestedDuplicateFolderEdits() {
  const base = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Alpha', 'https://example.com/nested-alpha'),
      ]),
      folder('Nested', [
        bookmark('Beta', 'https://example.com/nested-beta'),
      ]),
    ]),
  ]);
  const local = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Alpha', 'https://example.com/nested-alpha'),
      ]),
      folder('Nested', [
        bookmark('Beta', 'https://example.com/nested-beta'),
      ]),
    ]),
  ]);
  const remote = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Alpha', 'https://example.com/nested-alpha'),
        bookmark('Remote Nested Note', 'https://example.com/remote-nested-note'),
      ]),
      folder('Nested', [
        bookmark('Beta', 'https://example.com/nested-beta'),
      ]),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const project = findToolbarFolder(result.bookmarks, 'Project');
  const nestedFolders = (project?.children || []).filter(node => node.title === 'Nested' && !node.url);

  assertEqual(nestedFolders.length, 2, 'nested duplicate folders should remain separate');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/nested-alpha').length, 1, 'nested alpha bookmark should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/nested-beta').length, 1, 'nested beta bookmark should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-nested-note').length, 1, 'remote nested edit should remain');
  assertEqual(result.summary.ambiguousFolderGroups, 1, 'nested duplicate folders should be marked ambiguous');
}

function preservesMovedBookmarkWhenRemoteEditedTheBookmark() {
  const base = tree([
    folder('Original Folder', [
      bookmark('Original Title', 'https://example.com/moved-and-edited'),
    ]),
  ]);
  const local = tree([
    folder('Moved Folder', [
      bookmark('Original Title', 'https://example.com/moved-and-edited'),
    ]),
  ]);
  const remote = tree([
    folder('Original Folder', [
      bookmark('Remote Edited Title', 'https://example.com/moved-and-edited'),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);
  const originalFolder = findToolbarFolder(result.bookmarks, 'Original Folder');
  const movedFolder = findToolbarFolder(result.bookmarks, 'Moved Folder');

  assert(Boolean(originalFolder), 'remote edited original folder should remain during move/edit conflict');
  assert(Boolean(movedFolder), 'local move destination should remain during move/edit conflict');
  assertEqual(
    findBookmarksByUrl(result.bookmarks, 'https://example.com/moved-and-edited').length,
    2,
    'move/edit conflict should preserve both bookmark variants',
  );
  assertIncludes(
    (originalFolder?.children || []).map(node => node.title),
    'Remote Edited Title',
    'remote edited bookmark title should remain',
  );
  assertIncludes(
    (movedFolder?.children || []).map(node => node.title),
    'Original Title',
    'local moved bookmark title should remain',
  );
}

function mergesNestedFolderConflictsWithoutDroppingEitherSide() {
  const base = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Base', 'https://example.com/base'),
      ]),
    ]),
  ]);
  const local = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Base', 'https://example.com/base'),
        bookmark('Local Nested', 'https://example.com/local-nested'),
      ]),
    ]),
  ]);
  const remote = tree([
    folder('Project', [
      folder('Nested', [
        bookmark('Base', 'https://example.com/base'),
        bookmark('Remote Nested', 'https://example.com/remote-nested'),
      ]),
    ]),
  ]);

  const result = mergeBookmarksWithBase(base, local, remote);

  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/base').length, 1, 'base nested bookmark should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/local-nested').length, 1, 'local nested change should remain');
  assertEqual(findBookmarksByUrl(result.bookmarks, 'https://example.com/remote-nested').length, 1, 'remote nested change should remain');
}

function tree(toolbarChildren: BookmarkInfo[], menuChildren: BookmarkInfo[] = []) {
  return [
    folder(RootBookmarksType.ToolbarFolder, toolbarChildren),
    folder(RootBookmarksType.MenuFolder, menuChildren),
    folder(RootBookmarksType.UnfiledFolder, []),
    folder(RootBookmarksType.MobileFolder, []),
  ];
}

function bookmark(title: string, url: string): BookmarkInfo {
  return {
    title,
    url,
  };
}

function folder(title: string, children: BookmarkInfo[]): BookmarkInfo {
  return {
    title,
    children,
  };
}

function toolbarChildren(bookmarks: BookmarkInfo[]) {
  return rootChildren(bookmarks, RootBookmarksType.ToolbarFolder);
}

function toolbarBookmarkTitles(bookmarks: BookmarkInfo[]) {
  return rootBookmarkTitles(bookmarks, RootBookmarksType.ToolbarFolder);
}

function rootChildren(bookmarks: BookmarkInfo[], rootTitle: RootBookmarksType) {
  return bookmarks.find(node => node.title === rootTitle)?.children || [];
}

function rootBookmarkTitles(bookmarks: BookmarkInfo[], rootTitle: RootBookmarksType) {
  return rootChildren(bookmarks, rootTitle)
    .filter(node => Boolean(node.url))
    .map(node => node.title);
}

function findToolbarFolder(bookmarks: BookmarkInfo[], title: string) {
  return toolbarChildren(bookmarks).find(node => node.title === title && !node.url);
}

function findBookmarksByUrl(bookmarks: BookmarkInfo[], url: string): BookmarkInfo[] {
  const result: BookmarkInfo[] = [];
  for (const node of bookmarks) {
    if (node.url === url) {
      result.push(node);
    }

    result.push(...findBookmarksByUrl(node.children || [], url));
  }
  return result;
}

function assert(value: boolean, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes(values: string[], expected: string, message: string) {
  if (!values.includes(expected)) {
    throw new Error(`${message}. Missing ${expected} in ${values.join(', ')}`);
  }
}

function assertNotIncludes(values: string[], unexpected: string, message: string) {
  if (values.includes(unexpected)) {
    throw new Error(`${message}. Found ${unexpected} in ${values.join(', ')}`);
  }
}
