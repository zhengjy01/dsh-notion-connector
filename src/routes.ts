/**
 * The /api/dsh-notion route family: connection status, token save (validates
 * against /v1/users/me before persisting), and token clear. Every route
 * carries a loopback-only trust fence (plus browser same-origin markers) —
 * these endpoints write credentials, so LAN-exposed dsh web deployments must
 * not serve them.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { clearConfig, friendlyNotionError, notionRequest, readConfig, writeConfig } from './notion.ts'

/** Route prefix of the Notion settings API. */
export const NOTION_API_PREFIX = '/api/dsh-notion'

/** Cap on JSON request bodies (token payloads are tiny). */
const MAX_JSON_BODY_BYTES = 64 * 1024

/** Loopback literal check plus browser same-origin markers (mirrors the pairing routes' fence). */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Write one JSON response. */
function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(value))
}

/** Read and parse a bounded JSON request body. */
function readJsonBody(request: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid json'))
      }
    })
    request.on('error', reject)
  })
}

/** The Notion settings route family. */
export function makeRoutes(): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: `${NOTION_API_PREFIX}/status`,
      handler: async (req, res) => {
        if ((req.method !== 'GET' && req.method !== 'POST') || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const cfg = readConfig()
        writeJson(res, 200, {
          configured: (cfg.token ?? '').trim() !== '',
          workspaceName: cfg.workspaceName ?? '',
          workspaceIcon: cfg.workspaceIcon ?? '',
        })
      },
    },
    {
      kind: 'exact',
      path: `${NOTION_API_PREFIX}/token`,
      handler: async (req, res) => {
        if (req.method !== 'POST' || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        let body: any
        try {
          body = await readJsonBody(req)
        } catch {
          writeJson(res, 400, { ok: false, error: '请求体无效' })
          return
        }
        const token = typeof body.token === 'string' ? body.token.trim() : ''
        if (token === '') {
          writeJson(res, 400, { ok: false, error: 'token 不能为空' })
          return
        }
        try {
          // Validate before persisting, and capture the workspace identity.
          const me = await notionRequest(token, 'GET', '/v1/users/me')
          const bot = (me !== null && typeof me === 'object' && me.bot) || {}
          const workspaceName = typeof bot.workspace_name === 'string' ? bot.workspace_name : ''
          let icon = ''
          if (bot.workspace_icon !== null && bot.workspace_icon !== undefined) {
            icon = String(bot.workspace_icon.emoji ?? bot.workspace_icon.file?.url ?? '')
          }
          writeConfig({ token, workspaceName, workspaceIcon: icon })
          writeJson(res, 200, { ok: true, workspaceName, workspaceIcon: icon })
        } catch (error) {
          writeJson(res, 200, { ok: false, error: friendlyNotionError(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${NOTION_API_PREFIX}/clear`,
      handler: async (req, res) => {
        if (req.method !== 'POST' || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        clearConfig()
        writeJson(res, 200, { ok: true })
      },
    },
  ]
}
