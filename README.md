# dsh-notion-connector

> **English** | [**中文**](README.zh.md)

A Notion connector plugin for DeepSeek Harness. Configure an Integration Token once, and both the agent and the Web GUI settings page can operate your Notion workspace.

## Features

- **Agent tools** (available automatically after configuration):
  - `notion_search` — search pages/databases
  - `notion_read_page` — read page title, properties, and content blocks (nested blocks are read recursively, up to 200 blocks)
  - `notion_query_database` — query database entries (filter / sorts / pagination)
  - `notion_create_page` — create a page (under a page or a database)
  - `notion_update_page` — update properties / archive
  - `notion_append_blocks` — append content blocks
- **Web settings page**: Settings → Notion — connection status, Token input (automatically validated and the workspace name is read on save), clear configuration, three-step guide
- **Storage**: the Token is stored in `~/.dsh/notion.json` (permissions 0600); the browser interacts with the plugin through the loopback-only `/api/dsh-notion-connector/*` endpoints; API calls use Node's native fetch, with no shell dependency

## Installation

```bash
dsh plugin --profile web add github:zhengjy01/dsh-notion-connector
```

Restart dsh web to activate the plugin.

## Usage

1. Open <https://www.notion.so/my-integrations> and create an internal integration; copy the Internal Integration Secret (starts with `secret_`)
2. In Notion, **Share** the pages/databases you want to access with the integration
3. In the GUI, go to Settings → Notion, paste the Token and save
4. After that, just tell the agent things like "search for XX in Notion" or "save this content to Notion"

## Development

```bash
pnpm install        # esbuild / typescript / type dependencies
pnpm build          # esbuild: lib/index.js (host) + lib/client.js (browser)
pnpm typecheck      # tsc --noEmit
pnpm install:local  # fast local dev install (copies to ~/.dsh/profiles/node_modules/dsh-notion-connector)
```

## Limitations

- Pages/databases must be shared with the integration before they can be accessed
- The Token is stored in plaintext in a private file in your home directory (permissions 0600)
- This plugin is third-party code: review the source before installing, and only use it from trusted sources

## License

MIT
