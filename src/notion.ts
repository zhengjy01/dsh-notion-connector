/**
 * Notion REST client + response trimmers for the dsh-notion plugin.
 *
 * Token storage: ~/.dsh/notion.json (0600), same convention as dsh-ssh's
 * host store. All API calls go through the Node 22+ global fetch — no shell,
 * no curl. Errors are normalized into NotionError with the API status/code so
 * callers can render friendly, actionable Chinese messages.
 */

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Notion REST base URL. */
export const NOTION_API = 'https://api.notion.com'
/** API version header value (2022-06-28 covers every endpoint used here). */
export const NOTION_VERSION = '2022-06-28'
/** Token/config file path. */
export const CONFIG_PATH = join(homedir(), '.dsh', 'notion.json')

/** Persisted configuration. */
export interface NotionConfig {
  /** Internal Integration Secret (never returned to the client or model). */
  token?: string
  /** Workspace name from /v1/users/me, captured at save time. */
  workspaceName?: string
  /** Workspace icon (emoji or file URL), captured at save time. */
  workspaceIcon?: string
}

/** Read the config file; any read/parse failure yields an empty config. */
export function readConfig(): NotionConfig {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? (parsed as NotionConfig) : {}
  } catch {
    return {}
  }
}

/** Persist the config file (0600, parent dir created). */
export function writeConfig(config: NotionConfig): void {
  mkdirSync(join(homedir(), '.dsh'), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
  chmodSync(CONFIG_PATH, 0o600)
}

/** Remove the config file (idempotent). */
export function clearConfig(): void {
  rmSync(CONFIG_PATH, { force: true })
}

/** Normalized Notion API error carrying the HTTP status and API code. */
export class NotionError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message)
    this.name = 'NotionError'
  }
}

/**
 * One raw Notion REST call with an explicit token (used by the settings
 * save flow before the token is persisted).
 */
export async function notionRequest(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<any> {
  const response = await fetch(NOTION_API + path, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data: any = null
  if (text !== '') {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!response.ok) {
    const message = data !== null && typeof data.message === 'string' ? data.message : `HTTP ${response.status}`
    const code = data !== null && typeof data.code === 'string' ? data.code : undefined
    throw new NotionError(message, response.status, code)
  }
  return data
}

/** Read the stored token and call the API; friendly error when unconfigured. */
export async function notionCall(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<any> {
  const token = (readConfig().token ?? '').trim()
  if (token === '') {
    throw new NotionError(
      'Notion 尚未配置：请在 设置 → Notion 中粘贴 Integration Token（在 https://www.notion.so/my-integrations 创建）。',
    )
  }
  return notionRequest(token, method, path, body, signal)
}

/** Map an error to a friendly, actionable Chinese message. */
export function friendlyNotionError(error: unknown): string {
  if (error instanceof NotionError) {
    const message = error.message || '未知错误'
    switch (error.status) {
      case 401:
        return `Notion token 无效或已被撤销（401）：${message}`
      case 404:
        return `Notion 资源不存在（404）：${message}。请确认页面/数据库已分享给该 Integration，且 id 正确。`
      case 400:
        return `Notion 请求参数错误（400 ${error.code ?? ''}）：${message}`
      case 409:
        return `Notion 冲突（409）：${message}`
      case 429:
        return `Notion 请求过于频繁（429）：${message}`
      default:
        return `Notion API 错误 [${error.status ?? '?'}]：${message}`
    }
  }
  return error instanceof Error ? error.message : String(error)
}

/** Accept a page id, a dashed UUID, or a full page URL; normalize to dashed UUID form. */
export function normalizeId(raw: string): string {
  let s = String(raw ?? '').trim()
  if (s.includes('/')) {
    s = (s.split('/').pop() ?? '').split('?')[0].split('#')[0]
  }
  s = s.replace(/-/g, '')
  if (/^[0-9a-fA-F]{32}$/.test(s)) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
  }
  return s
}

/** Join a rich_text array into plain text. */
export function plainText(rich: unknown): string {
  if (!Array.isArray(rich)) return ''
  let out = ''
  for (const r of rich) {
    if (r !== null && typeof r === 'object' && typeof (r as any).plain_text === 'string') {
      out += (r as any).plain_text
    }
  }
  return out
}

/** Simplify one property value to a scalar the model can read. */
export function propValue(p: any): unknown {
  if (p === null || p === undefined) return null
  switch (p.type) {
    case 'title': return plainText(p.title)
    case 'rich_text': return plainText(p.rich_text)
    case 'number': return p.number
    case 'select': return p.select ? p.select.name : null
    case 'status': return p.status ? p.status.name : null
    case 'multi_select': return (p.multi_select ?? []).map((s: any) => s.name)
    case 'date': return p.date ? (p.date.start + (p.date.end ? ` → ${p.date.end}` : '')) : null
    case 'checkbox': return p.checkbox
    case 'url': return p.url
    case 'email': return p.email
    case 'phone_number': return p.phone_number
    case 'people': return (p.people ?? []).map((u: any) => u.name ?? u.id)
    case 'relation': return (p.relation ?? []).map((r: any) => r.id)
    case 'formula': return p.formula ? p.formula[p.formula.type] : null
    case 'rollup': return p.rollup
      ? (p.rollup.type === 'number' ? p.rollup.number : (p.rollup.array ?? []).map(propValue))
      : null
    case 'created_by': return p.created_by ? p.created_by.name : null
    case 'last_edited_by': return p.last_edited_by ? p.last_edited_by.name : null
    case 'created_time': return p.created_time
    case 'last_edited_time': return p.last_edited_time
    default: return JSON.stringify(p)
  }
}

/** Render a page/database property map as plain key → simplified value. */
export function simplifyProperties(props: any): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (props !== null && typeof props === 'object') {
    for (const key of Object.keys(props)) out[key] = propValue(props[key])
  }
  return out
}

/** Compact one /v1/search result. */
export function trimSearchResult(r: any): Record<string, unknown> {
  let title = ''
  if (r.object === 'database') title = plainText(r.title)
  else if (r.properties !== null && r.properties !== undefined && r.properties.title !== undefined) {
    title = plainText(r.properties.title.title)
  }
  return {
    id: r.id,
    type: r.object,
    title: title || r.id,
    url: r.url ?? null,
    edited: r.last_edited_time ?? null,
    databaseId: (r.parent && r.parent.database_id) ?? null,
  }
}

/** Extract the plain text of one block. */
export function blockText(b: any): string {
  const t = b.type
  if (t === 'child_page') return b.child_page ? b.child_page.title : ''
  if (t === 'child_database') return b.child_database ? b.child_database.title : ''
  if (t === 'divider') return '---'
  if (t === 'table_row') return (b.table_row.cells ?? []).map((c: any) => plainText(c)).join(' | ')
  if (t === 'equation') return b.equation ? b.equation.expression : ''
  if (t === 'synced_block') return ''
  const inner = b[t]
  if (inner !== null && inner !== undefined && Array.isArray(inner.rich_text)) return plainText(inner.rich_text)
  if (inner !== null && inner !== undefined && typeof inner.url === 'string') {
    const caption = plainText(inner.caption ?? [])
    return inner.url + (caption.length > 0 ? ` ${caption}` : '')
  }
  return ''
}

/** Block types whose children are worth recursing into. */
const NESTED_TYPES: Record<string, true> = {
  toggle: true,
  bulleted_list_item: true,
  numbered_list_item: true,
  quote: true,
  callout: true,
  paragraph: true,
  synced_block: true,
  template: true,
  table: true,
}

/** Fetch a block's children recursively (paginated, bounded). */
export async function fetchBlocksRecursive(
  blockId: string,
  depth: number,
  cap: number,
  signal?: AbortSignal,
): Promise<any[]> {
  const out: any[] = []
  let cursor: string | null = null
  for (;;) {
    let path = `/v1/blocks/${encodeURIComponent(normalizeId(blockId))}/children?page_size=100`
    if (cursor !== null) path += `&start_cursor=${encodeURIComponent(cursor)}`
    const res = await notionCall('GET', path, undefined, signal)
    const list: any[] = res.results ?? []
    for (const b of list) {
      if (out.length >= cap) return out
      const item: any = { id: b.id, type: b.type, text: blockText(b) }
      if (depth > 0 && b.has_children === true && NESTED_TYPES[b.type] === true) {
        try {
          const kids = await fetchBlocksRecursive(b.id, depth - 1, cap - out.length, signal)
          if (kids.length > 0) item.children = kids
        } catch (error) {
          item.childrenError = friendlyNotionError(error)
        }
      }
      out.push(item)
    }
    if (res.has_more !== true || typeof res.next_cursor !== 'string') return out
    cursor = res.next_cursor
  }
}

/** Read one page: metadata + simplified properties + (optional) content blocks. */
export async function readPage(
  pageIdRaw: string,
  includeChildren: boolean,
  depth: number,
  signal?: AbortSignal,
): Promise<any> {
  const pageId = normalizeId(pageIdRaw)
  const page = await notionCall('GET', `/v1/pages/${encodeURIComponent(pageId)}`, undefined, signal)
  let title = ''
  if (page.properties !== null && page.properties !== undefined && page.properties.title !== undefined) {
    title = plainText(page.properties.title.title)
  }
  const result: any = {
    id: page.id,
    url: page.url ?? null,
    title,
    properties: simplifyProperties(page.properties),
  }
  if (includeChildren) result.blocks = await fetchBlocksRecursive(pageId, depth, 200, signal)
  return { ok: true, page: result }
}

/**
 * Accept both a parsed json arg and its JSON-string encoding. Depending on
 * the calling layer, `{ type: 'json' }` tool params can arrive as strings;
 * Notion's API rejects arrays/objects serialized as strings.
 */
export function asJsonArg(v: unknown): unknown {
  return typeof v === 'string' ? JSON.parse(v) : v
}

/** Query a database with an optional native filter/sorts, paginated. */
export async function queryDatabase(args: any, signal?: AbortSignal): Promise<any> {
  const body: any = { page_size: Math.min(Math.max(args.pageSize ?? 20, 1), 100) }
  if (args.filter !== undefined) body.filter = asJsonArg(args.filter)
  if (args.sorts !== undefined) body.sorts = asJsonArg(args.sorts)
  if (args.startCursor !== undefined) body.start_cursor = args.startCursor
  const res = await notionCall(
    'POST',
    `/v1/databases/${encodeURIComponent(normalizeId(args.databaseId))}/query`,
    body,
    signal,
  )
  return {
    ok: true,
    count: (res.results ?? []).length,
    hasMore: res.has_more === true,
    nextCursor: res.has_more === true ? res.next_cursor : null,
    results: (res.results ?? []).map((r: any) => ({
      id: r.id,
      url: r.url ?? null,
      properties: simplifyProperties(r.properties),
    })),
  }
}
