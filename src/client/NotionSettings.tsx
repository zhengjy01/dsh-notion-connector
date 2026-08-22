/**
 * Notion settings page component (JSX lives in .tsx by tsc's rule).
 */

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/** Route prefix of the host settings API (see src/routes.ts). */
const API = '/api/dsh-notion'

/** Connection status returned by POST /api/dsh-notion/status. */
interface Status {
  configured: boolean
  workspaceName: string
  workspaceIcon: string
}

/** One inline style sheet fragment (kept minimal — the shell owns the look). */
const styles: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5, padding: '4px 2px' },
  title: { margin: 0, fontSize: 15 },
  status: { padding: '8px 10px', borderRadius: 6, background: 'rgba(127,127,127,.12)' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(127,127,127,.35)', background: 'rgba(127,127,127,.1)', color: 'inherit', font: 'inherit' },
  button: { padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' },
  buttonPrimary: { padding: '5px 12px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', font: 'inherit', cursor: 'pointer' },
  buttonDisabled: { opacity: 0.5, cursor: 'default' },
  ok: { color: '#22c55e' },
  err: { color: '#ef4444' },
  hint: { opacity: 0.75, fontSize: 12 },
  hintP: { margin: '4px 0' },
}

/** Fetch one JSON route. Always POST so browsers send Origin (required by authenticated reverse proxies on /api/*). */
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body === undefined ? {} : body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

/** The Notion connection settings page. */
export function NotionSettings() {
  const [status, setStatus] = useState<Status | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    api<Status>('/status')
      .then(setStatus)
      .catch((error: unknown) => {
        setMessage({ kind: 'err', text: `读取状态失败: ${error instanceof Error ? error.message : String(error)}` })
      })
  }, [])

  const save = useCallback(() => {
    const value = token.trim()
    if (value === '') {
      setMessage({ kind: 'err', text: '请先粘贴 Integration Token' })
      return
    }
    setBusy(true)
    setMessage(null)
    api<{ ok: boolean; workspaceName?: string; workspaceIcon?: string; error?: string }>('/token', { token: value })
      .then((result) => {
        if (result.ok === true) {
          setToken('')
          setStatus({ configured: true, workspaceName: result.workspaceName ?? '', workspaceIcon: result.workspaceIcon ?? '' })
          setMessage({ kind: 'ok', text: `连接成功：${result.workspaceName || 'Notion 工作区'}` })
        } else {
          setMessage({ kind: 'err', text: result.error ?? '保存失败' })
        }
      })
      .catch((error: unknown) => {
        setMessage({ kind: 'err', text: `保存失败: ${error instanceof Error ? error.message : String(error)}` })
      })
      .finally(() => setBusy(false))
  }, [token])

  const clear = useCallback(() => {
    setBusy(true)
    api<{ ok: boolean }>('/clear', {})
      .then(() => {
        setStatus({ configured: false, workspaceName: '', workspaceIcon: '' })
        setMessage({ kind: 'ok', text: '已清除配置' })
      })
      .catch((error: unknown) => {
        setMessage({ kind: 'err', text: `清除失败: ${error instanceof Error ? error.message : String(error)}` })
      })
      .finally(() => setBusy(false))
  }, [])

  const connected = status !== null && status.configured

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Notion 连接</h2>
      <div style={styles.status}>
        {connected
          ? <span>已连接：<strong>{status.workspaceName || '(未命名工作区)'}</strong></span>
          : <span style={styles.err}>未配置</span>}
      </div>
      <div style={styles.row}>
        <input
          style={styles.input}
          type="password"
          placeholder="粘贴 Notion Integration Token (secret_...)"
          value={token}
          spellCheck={false}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>
      <div style={styles.row}>
        <button style={busy ? { ...styles.buttonPrimary, ...styles.buttonDisabled } : styles.buttonPrimary} disabled={busy} onClick={save}>测试并保存</button>
        {connected
          ? <button style={busy ? { ...styles.button, ...styles.buttonDisabled } : styles.button} disabled={busy} onClick={clear}>清除配置</button>
          : null}
      </div>
      {message !== null
        ? <div style={message.kind === 'ok' ? styles.ok : styles.err}>{message.text}</div>
        : null}
      <div style={styles.hint}>
        <p style={styles.hintP}>1. 打开集成管理页创建一个 Integration（内部集成），复制 Internal Integration Secret。</p>
        <p style={styles.hintP}>2. 在 Notion 中把要访问的页面/数据库 Share 给该 Integration。</p>
        <p style={styles.hintP}>3. 把 Secret 粘贴到上方并保存；保存时会自动校验并读取工作区信息。</p>
        <p style={styles.hintP}>配置后可用工具：notion_search、notion_read_page、notion_query_database、notion_create_page、notion_update_page、notion_append_blocks。</p>
        <p style={styles.hintP}>创建 Integration：<a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">https://www.notion.so/my-integrations</a></p>
      </div>
    </div>
  )
}
