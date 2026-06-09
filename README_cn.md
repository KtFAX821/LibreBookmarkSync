# LibreBookmarkSync

LibreBookmarkSync 是一个无账号、开源、本地优先的浏览器书签同步扩展，用来在不同浏览器之间同步书签。

本项目基于公开发布、采用 Apache-2.0 许可证的 BookmarkHub 源码继续开发，新增功能均在本源码树中独立实现。本项目不包含、不复制、不反编译、不绕过，也不重新分发任何后续商业版或商店发行版中的专有代码。

LibreBookmarkSync 没有登录、订阅、专业版、许可证密钥或集中式授权检查。用户数据只会保存到用户自己配置的存储后端。

## 当前功能

- 手动上传和下载书签。
- 默认使用 WebDAV 存储后端。
- 可选保留 GitHub Gist 兼容后端。
- 可选本地自动同步计时器。
- 自动上传前的大量删除保护。
- 本地同步历史。
- 本地书签快照和恢复。
- 可选 AES-GCM 远程书签内容加密。

## 存储

LibreBookmarkSync 当前支持：

- WebDAV：默认用于用户自有的远程书签文件。
- GitHub Gist：作为已有 Gist 用户的可选兼容后端。

GitHub 和 WebDAV 账号只是用户自行选择的第三方存储后端账号，不是 LibreBookmarkSync 账号。本扩展不会连接到项目方运营的账号服务。

## 加密

加密是可选功能。启用后，书签内容会在上传前通过浏览器 Web Crypto 使用 AES-GCM 和 PBKDF2 加密。

当前第一版实现会把加密密码保存在本机浏览器扩展存储中。密码不会发送到 LibreBookmarkSync 服务。如果密码丢失，已加密的远程书签数据无法恢复。

## 本地开发

安装依赖：

```sh
corepack pnpm install
```

类型检查：

```sh
npm run compile
```

运行 WXT 开发服务：

```sh
npm run dev
```

构建：

```sh
npm run build
```

完整发布验证：

```sh
npm run verify:release
```

## 项目规则

- 不添加账号、注册、订阅、专业版、试用、许可证密钥或授权检查。
- 不连接 `memoload.com` 或项目方运营的账号后端。
- 默认不包含 Sentry 或遥测。
- 不复制闭源商店发行版中的代码或资源。
- 保留 Apache-2.0 许可证义务和署名说明。

## 文档

- 实施计划：`docs/IMPLEMENTATION_PLAN.md`
- 隐私说明：`docs/PRIVACY.md`
- 权限说明：`docs/PERMISSIONS.md`
- 第三方许可证：`docs/THIRD_PARTY_LICENSES.md`
- 发布检查清单：`docs/RELEASE_CHECKLIST.md`
- 真实浏览器测试清单：`docs/RUNTIME_SMOKE_TESTS_cn.md`
- GitHub 发布指南：`docs/GITHUB_PUBLISHING.md`
- 版权和署名说明：`NOTICE`

## 许可证

Apache-2.0。请查看 `LICENSE` 和 `NOTICE`。
