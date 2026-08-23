/**
 * Agent tools for dsh-notion: search, read page, query database, create /
 * update pages, append blocks. Every tool talks to the same Notion REST API
 * and config store the settings page manages, so a token saved in the GUI is
 * immediately usable by any agent (and vice versa).
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import {
  asJsonArg,
  friendlyNotionError,
  notionCall,
  normalizeId,
  queryDatabase,
  readPage,
  simplifyProperties,
  trimSearchResult,
} from './notion.ts'

/** One text content block (the only render shape these tools emit). */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/** JSON render shared by every tool output. */
function renderJson(_args: unknown, value: unknown): ContentBlock[] {
  return text(JSON.stringify(value, null, 2))
}

/** The workspace search tool. */
export function notionSearchTool() {
  return defineTool({
    name: 'notion_search',
    description: '在已配置的 Notion 工作区搜索页面与数据库。返回每个结果的 id、类型、标题、URL 与最后编辑时间。' +
      'Triggers: Notion, 搜索 Notion, 在 Notion 里找.',
    parameters: {
      query: { type: 'string', description: '搜索关键词；省略则返回工作区最近更新的内容' },
      objectType: { type: 'string', enum: ['page', 'database'], description: '仅返回该类型的对象' },
      limit: { type: 'integer', description: '返回条数上限，默认 10，最大 50' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      const body: any = { page_size: Math.min(Math.max(args.limit ?? 10, 1), 50) }
      if (args.query !== undefined && args.query !== '') body.query = args.query
      if (args.objectType !== undefined) body.filter = { value: args.objectType, property: 'object' }
      const res = await notionCall('POST', '/v1/search', body)
      return {
        ok: true,
        count: (res.results ?? []).length,
        hasMore: res.has_more === true,
        results: (res.results ?? []).map(trimSearchResult),
      }
    },
  })
}

/** The page reader tool. */
export function notionReadPageTool() {
  return defineTool({
    name: 'notion_read_page',
    description: '读取 Notion 页面的标题、属性与内容块。pageId 可传页面 id（形如 8ab3e1c2-xxxx-...）或完整页面 URL。' +
      'Triggers: 读取 Notion 页面, 查看 Notion 内容.',
    parameters: {
      pageId: { type: 'string', required: true, description: '页面 id 或完整页面 URL' },
      includeChildren: { type: 'boolean', description: '是否同时读取页面内容块（默认 true）' },
      depth: { type: 'integer', description: '嵌套块递归深度（默认 2，最大 3）' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      const depth = args.depth === undefined ? 2 : Math.min(Math.max(args.depth, 0), 3)
      return readPage(String(args.pageId), args.includeChildren !== false, depth)
    },
  })
}

/** The database query tool. */
export function notionQueryDatabaseTool() {
  return defineTool({
    name: 'notion_query_database',
    description: '查询 Notion 数据库条目。filter 与 sorts 使用 Notion API 原生结构（见 https://developers.notion.com/reference/post-database-query）。' +
      'Triggers: 查询 Notion 数据库, 数据库条目.',
    parameters: {
      databaseId: { type: 'string', required: true, description: '数据库 id 或 URL' },
      filter: { type: 'json', description: '过滤条件（Notion 原生 filter 对象，如 {"property":"状态","select":{"equals":"进行中"}}）' },
      sorts: { type: 'json', description: '排序数组（Notion 原生 sorts）' },
      pageSize: { type: 'integer', description: '每页条数，默认 20，最大 100' },
      startCursor: { type: 'string', description: '翻页游标（上一次结果的 nextCursor）' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      return queryDatabase(args)
    },
  })
}

/** The page creation tool. */
export function notionCreatePageTool() {
  return defineTool({
    name: 'notion_create_page',
    description: '在 Notion 中创建页面。properties 与 children 使用 Notion API 原生结构（见 https://developers.notion.com/reference/post-page）。' +
      'Triggers: 创建 Notion 页面, 写入 Notion, 保存到 Notion.',
    parameters: {
      parentType: { type: 'string', enum: ['page', 'database'], required: true, description: '父对象类型' },
      parentId: { type: 'string', required: true, description: '父页面或父数据库的 id / URL' },
      properties: { type: 'json', description: '页面属性对象，如 {"Name": {"title": [{"text": {"content": "标题"}}]}}' },
      children: { type: 'json', description: '页面内容块数组（Notion block 对象）' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      const parent = args.parentType === 'database'
        ? { database_id: normalizeId(args.parentId) }
        : { page_id: normalizeId(args.parentId) }
      const body: any = { parent, properties: asJsonArg(args.properties) ?? {} }
      if (args.children !== undefined) body.children = asJsonArg(args.children)
      const res = await notionCall('POST', '/v1/pages', body)
      return { ok: true, id: res.id, url: res.url }
    },
  })
}

/** The page update tool. */
export function notionUpdatePageTool() {
  return defineTool({
    name: 'notion_update_page',
    description: '更新 Notion 页面的属性或归档状态。properties 使用 Notion API 原生结构。' +
      'Triggers: 更新 Notion 页面, 修改 Notion 属性.',
    parameters: {
      pageId: { type: 'string', required: true, description: '页面 id / URL' },
      properties: { type: 'json', description: '要更新的属性（Notion 原生结构）' },
      archived: { type: 'boolean', description: 'true 归档页面，false 恢复页面' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      const body: any = {}
      if (args.properties !== undefined) body.properties = asJsonArg(args.properties)
      if (typeof args.archived === 'boolean') body.archived = args.archived
      if (Object.keys(body).length === 0) throw new Error('请至少提供 properties 或 archived')
      const res = await notionCall('PATCH', `/v1/pages/${normalizeId(args.pageId)}`, body)
      return { ok: true, id: res.id, url: res.url, archived: res.archived === true }
    },
  })
}

/** The block appender tool. */
export function notionAppendBlocksTool() {
  return defineTool({
    name: 'notion_append_blocks',
    description: '向 Notion 页面或块追加内容块。children 为 Notion block 对象数组（Notion 原生结构）。' +
      'Triggers: 追加 Notion 内容, 往 Notion 页面添加内容.',
    parameters: {
      blockId: { type: 'string', required: true, description: '目标页面/块 id 或 URL' },
      children: { type: 'json', required: true, description: '要追加的块数组（Notion 原生结构）' },
      after: { type: 'string', description: '在此块之后插入' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    timeoutMs: 60_000,
    async execute(args) {
      const body: any = { children: asJsonArg(args.children) }
      if (args.after !== undefined) body.after = normalizeId(args.after)
      const res = await notionCall('PATCH', `/v1/blocks/${normalizeId(args.blockId)}/children`, body)
      return { ok: true, inserted: (res.results ?? []).map((b: any) => b.id) }
    },
  })
}

/** All six tools, ready for ctx.tools.register. */
export function notionTools() {
  return [
    notionSearchTool(),
    notionReadPageTool(),
    notionQueryDatabaseTool(),
    notionCreatePageTool(),
    notionUpdatePageTool(),
    notionAppendBlocksTool(),
  ]
}

/** Re-export the friendly error mapping so routes reuse the same wording. */
export { friendlyNotionError, simplifyProperties }
