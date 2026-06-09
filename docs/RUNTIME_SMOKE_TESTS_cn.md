# LibreBookmarkSync 真实浏览器测试清单

最后更新：2026-06-08

这份清单用于真实浏览器扩展测试。它不是网站测试，也不是服务器测试。测试前先运行：

```powershell
npm.cmd run verify:release
```

## 三个发行包

生成后的三个包在：

```text
D:\BookmarkHub-main\.output\libre-bookmark-sync-0.1.0-local-chrome.zip
D:\BookmarkHub-main\.output\libre-bookmark-sync-0.1.0-firefox.zip
D:\BookmarkHub-main\.output\libre-bookmark-sync-0.1.0-sources.zip
```

本地加载扩展时不要选择 zip，选择下面的构建目录：

```text
Chrome / Edge:
D:\BookmarkHub-main\.output\chrome-mv3

Firefox:
D:\BookmarkHub-main\.output\firefox-mv2\manifest.json
```

常见错误：

- `libre-bookmark-sync-0.1.0-sources.zip` 是源码包，不是浏览器扩展安装包。Edge/Chrome 不能加载它。
- Edge/Chrome 测试时不要选择 `.output` 目录，也不要选择任何 zip 文件，必须选择包含 `manifest.json` 的 `.output\chrome-mv3` 文件夹。
- 如果要测试 zip 包，请先解压 `libre-bookmark-sync-0.1.0-local-chrome.zip`，再加载解压后包含 `manifest.json` 的文件夹。

## 测试前准备

- 使用临时浏览器配置，或者先备份真实书签。
- WebDAV 使用临时目录或临时文件路径，例如 `/libre-bookmark-sync-test.json`。
- 不要把 WebDAV 密码、GitHub token 或真实私密书签发给开发者。
- 不要参考或复制 `fohimdklhhcpcnpmmichieidclgfdmol/` 里的闭源发行版内容。

## Chrome / Edge 加载

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展”。
4. 选择：

```text
D:\BookmarkHub-main\.output\chrome-mv3
```

期望结果：

- 扩展名称显示为 LibreBookmarkSync。
- Popup 可以打开。
- Options 页面可以打开。
- 页面上没有账号、登录、付费、订阅或商业授权入口。
- 必需权限只有 storage、bookmarks、notifications、alarms。
- GitHub Gist 和 WebDAV 主机访问是可选权限，只在设置页按需申请。

## Edge 自动页面检查

如果要先确认 Edge 里的 popup/options 页面能渲染、没有明显运行时错误，可以运行：

```powershell
npm.cmd run smoke:edge:runtime
```

这个命令会用 `.output\chrome-mv3` 启动一个隔离的 Edge 配置，并通过 Chrome DevTools Protocol 打开扩展的 options 和 popup 页面。它会在 `.tmp\runtime-smoke` 下生成 JSON 报告。

注意：

- 这个检查会启动真实 Edge 浏览器窗口。
- 它只检查扩展页面是否能加载和渲染，不会测试书签增删、WebDAV 权限、上传下载、通知、闹钟、加密或自动同步。
- 如果运行失败，请记录报告文件路径、页面错误和 Edge 版本。

## Firefox 加载

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”。
3. 选择：

```text
D:\BookmarkHub-main\.output\firefox-mv2\manifest.json
```

期望结果：

- 扩展名称显示为 LibreBookmarkSync。
- Popup 和 Options 页面可以打开。
- 临时扩展没有明显控制台错误。

## Chrome / Edge 书签数量回归测试

这个测试用于确认“浏览器真实桌面书签数”和扩展 popup 的“本地书签”一致。之前出现过 Chrome 书签管理器可见书签是 43 个，但 popup 显示 60 个的情况。

1. 在 Chrome 或 Edge 加载 `.output\chrome-mv3`。
2. 打开浏览器书签/收藏夹管理器。
3. 只统计桌面可见的 URL 书签：书签栏/收藏夹栏、其他书签/其他收藏夹。
4. 不把移动书签、受管理书签、隐藏根目录、分隔符算进普通桌面书签。
5. 打开 LibreBookmarkSync popup。
6. 确认“本地书签”数量等于第 3 步统计的数量。例如 Chrome 可见桌面书签是 43 个时，popup 应显示 43，而不是 60。
7. 使用临时或已备份的 WebDAV/Gist 远端文件，从 Chrome 上传。
8. 在 Edge 下载。
9. 确认 Edge 的桌面可见书签数量与 Chrome 一致，并且没有把被跳过的移动/隐藏根目录重建成普通桌面书签。

如果数量不一致：

1. 打开 Options。
2. 找到 Diagnostics / 诊断。
3. 生成诊断报告。
4. 只记录下面几行，不要发送书签标题、URL、密码或 token：

```text
Live Syncable Local Count
Raw Browser URL Count
Skipped Local Count
Root Summary
```

## WebDAV 手动同步测试

1. 打开 Options。
2. Storage Type 选择 WebDAV。
3. 填入 WebDAV Server URL、Username、Password、File Path。
4. Chrome / Edge 下先点击 `Grant WebDAV Permission`。
5. 点击 `Test Storage`。
6. 新建几个临时书签。
7. 打开 Popup，点击上传。
8. 修改或删除这些临时书签。
9. 点击下载，确认书签能按远端文件恢复。

期望结果：

- 正确 WebDAV 信息能通过连接测试。
- 错误密码会显示清楚的失败提示。
- 上传会写入用户自己的 WebDAV 文件。
- 下载不会要求任何项目账号。
- Sync History 能看到成功或失败记录。

## GitHub Gist 手动同步测试

1. 打开 Options。
2. Storage Type 选择 GitHub Gist。
3. 使用临时 token 和临时 Gist。
4. 先点击 GitHub Gist 权限授权按钮。
5. 新建几个临时书签。
6. 打开 Popup，点击上传。
7. 修改或删除这些临时书签。
8. 点击下载，确认书签能按远端文件恢复。

期望结果：

- Gist 主机权限只在授权时请求。
- 上传会写入 LibreBookmarkSync 同步文档。
- 下载不会要求任何项目账号。
- 不会访问 `memoload.com` 或任何项目账号后端。

## 加密测试

1. Options 中启用 Encryption。
2. 输入临时密码并保存。
3. 上传到临时 WebDAV/Gist 文件。
4. 打开远端文件，确认看不到明文书签标题和 URL。
5. 用正确密码下载，确认可以恢复。
6. 改成错误密码再下载。

期望结果：

- 正确密码可以恢复书签。
- 错误密码会失败，并且不会清空或覆盖本地书签。
- 密码不会出现在远端文件里。

## 快照恢复测试

1. 先上传或下载一次，让扩展产生本地快照。
2. 在 Options 的 Local Snapshots 区域确认快照出现。
3. 修改临时书签。
4. 点击 Restore。

期望结果：

- 本地书签恢复到快照状态。
- 快照恢复不需要联网。
- 破坏性操作前会保留安全快照。

## 自动同步测试

1. Options 中启用 Auto Sync。
2. 使用较短同步间隔。
3. 上传一个基础书签树。
4. 只改本地临时书签，等待自动同步。
5. 只改远端临时文件，等待自动同步。
6. 本地和远端分别新增不同书签，等待自动同步。
7. 只在一边删除一个基准书签，另一边保持不变，等待自动同步。
8. 测试大量删除时是否出现保护提示。

期望结果：

- 本地单边新增可以自动上传。
- 远端单边变更可以自动下载。
- 双边新增会合并，不丢数据。
- 有基准且另一边未变时，明确的单边删除可以被接受。
- 大量删除不会静默自动覆盖远端。
- 有冲突或高风险时 Popup / Options 显示可读提示。

## 需要回报给开发者的信息

测试失败时，请记录：

- 浏览器名称和版本。
- 使用的是 Chrome MV3、Edge MV3 还是 Firefox MV2。
- 加载的是哪个路径。
- WebDAV/Gist 测试是连接、上传、下载、加密、快照还是自动同步失败。
- 页面显示的错误提示原文。
- 扩展后台或页面控制台里的错误信息。
- 如果是书签数量问题，记录诊断报告里的 `Live Syncable Local Count`、`Raw Browser URL Count`、`Skipped Local Count`、`Root Summary`。
- 不要发送 WebDAV 密码、GitHub token 或真实书签内容。
