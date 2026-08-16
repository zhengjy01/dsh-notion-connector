/**
 * dsh-notion — host half. Mounts the Notion REST client, the /api/dsh-notion
 * route family (status / save-token / clear-token), the agent tools
 * (notion_search, notion_read_page, notion_query_database, notion_create_page,
 * notion_update_page, notion_append_blocks), and a system-prompt
 * announcement. The browser half (./client) renders the settings page.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { makeRoutes } from './routes.ts'
import { notionTools } from './tools.ts'

/** Stable cordis plugin name. */
export const name = 'notion'

/** Services required before the Notion surfaces can mount. */
export const inject = ['webServer', 'tools', 'systemPrompt']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const NOTION_GUIDANCE = '本机已安装 dsh-notion 插件（Notion 连接）：配置一次 Integration Token 后可用 notion_search 搜索页面/数据库、notion_read_page 读取页面内容、notion_query_database 查询数据库条目、notion_create_page 创建页面、notion_update_page 更新属性/归档、notion_append_blocks 追加内容块。Token 存 ~/.dsh/notion.json（权限 0600），在 GUI 设置 → Notion 配置；页面/数据库需先分享给该 Integration。用户提到「Notion / 浮墨 / 知识库 / 笔记」时即指本插件，请据此协作。'

/** Mount the Notion surfaces. */
export function apply(ctx: Context): void {
  // Agent tools.
  ctx.effect(
    () => {
      const disposers = notionTools().map(tool => ctx.tools.register(tool))
      return () => {
        for (const dispose of disposers) dispose()
      }
    },
    'dsh-notion: tools',
  )

  // Settings routes.
  ctx.effect(
    () => {
      const disposers = makeRoutes().map(route => ctx.webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    },
    'dsh-notion: routes',
  )

  // Announce the plugin to every agent.
  ctx.effect(
    () => ctx.systemPrompt.section({ name: 'plugin:dsh-notion', order: SECTION_ORDER, text: NOTION_GUIDANCE }),
    'dsh-notion: announcement',
  )
}
