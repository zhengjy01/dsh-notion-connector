# dsh-notion-connector

> [**English**](README.md) | **中文**

DeepSeek Harness 的 Notion 连接插件。配置一次 Integration Token 后，agent 与 Web GUI 设置页都可以操作你的 Notion 工作区。

## 功能

- **Agent 工具**（配置后自动可用）：
  - `notion_search` — 搜索页面/数据库
  - `notion_read_page` — 读取页面标题、属性、内容块（嵌套递归，最多 200 块）
  - `notion_query_database` — 查询数据库条目（filter / sorts / 翻页）
  - `notion_create_page` — 创建页面（页面或数据库下）
  - `notion_update_page` — 更新属性 / 归档
  - `notion_append_blocks` — 追加内容块
- **Web 设置页**：设置 → Notion — 连接状态、Token 粘贴（保存时自动校验并读取工作区名）、清除配置、三步指引
- **存储**：Token 存 `~/.dsh/notion.json`（权限 0600）；通过 loopback-only 的 `/api/dsh-notion-connector/*` 与浏览器半交互；API 调用走 Node 原生 fetch，无 shell 依赖

## 安装

```bash
dsh plugin --profile web add github:zhengjy01/dsh-notion-connector
```

重启 dsh web 后生效。

## 使用

1. 打开 <https://www.notion.so/my-integrations> 创建内部集成，复制 `secret_` 开头的 Internal Integration Secret
2. 在 Notion 中把要访问的页面/数据库 **Share 给该集成**
3. GUI 设置 → Notion 粘贴并保存
4. 之后对 agent 说「搜索 Notion 里的 XX」「把这段内容存进 Notion」即可

## 开发

```bash
pnpm install        # esbuild / typescript / 类型依赖
pnpm build          # esbuild: lib/index.js (host) + lib/client.js (browser)
pnpm typecheck      # tsc --noEmit
pnpm install:local  # 本地开发快速安装（复制到 ~/.dsh/profiles/node_modules/dsh-notion-connector）
```

## 限制

- 页面/数据库必须分享给该 Integration 才能访问
- Token 以明文保存在用户主目录私有文件（权限 0600）
- 插件是第三方代码：安装前请审阅源码，只在信任的来源使用

## License

MIT
