/**
 * Browser-half entry for the dsh-notion plugin — runs inside the dsh web GUI.
 *
 * Registers the Notion connection page into the additive `settings.section`
 * list slot (nav label "Notion"). All data flows through the loopback-fenced
 * /api/dsh-notion routes on the host.
 *
 * Export discipline (packages/client rule): the /client surface carries what
 * cordis loading needs plus types only — all value exports stay internal.
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slots service's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NotionSettings } from './NotionSettings.tsx'

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots']

/** Mount the Notion settings page. */
export function apply(ctx: ClientContext): void {
  // Direct injection (no ctx.effect wrapper): mirrors the web-ui-settings
  // precedent — the slots service owns the injection's lifetime.
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'notion', order: 30, label: 'Notion' },
    () => createElement(NotionSettings),
  ))
}
