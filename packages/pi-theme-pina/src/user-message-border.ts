/**
 * Render submitted user messages with a left accent bar outside the message
 * background, matching the input editor's panel (src/editor.ts), whose render
 * is the same bar column + background panel structure.
 *
 * Pi paints userMessageBg from column 0 across every rendered user-message
 * line and exposes no theme token or component hook for a border, so text
 * prefixes from a markdown transformer unavoidably land inside the block. This
 * module instead patches the public UserMessageComponent's render: each line
 * gets the accent bar prepended (drawn on the terminal canvas, left of the
 * background) and one background column shaved off via truncateToWidth, so the
 * block's left edge moves right of the bar while the total width stays stable.
 * Background-free lines (inline images) are left untouched. Feature-detected
 * and idempotent; display-only, session data and model context keep the raw
 * text.
 *
 * Reload safety: /reload re-evaluates this module and re-runs install, so the
 * original render is anchored on the prototype and every install re-wraps
 * from that anchor — wrappers replace each other instead of stacking, and
 * closures holding a stale ctx leave the call chain. Theme resolution tolerates
 * the stale window: pi rejects ctx.ui access after session replacement or
 * reload, which is caught and the last good theme is reused until the fresh
 * session's ctx takes over.
 */
import {
  UserMessageComponent,
  type ExtensionContext,
  type Theme,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth } from '@earendil-works/pi-tui'

const BAR = '▌'

// Upstream prefixes the first/last rendered lines with OSC 133 semantic prompt
// markers (ESC]133;A / B / C). Ghostty parses these: 133;A means an implicit
// fresh-line (CR+LF) whenever the cursor is not at column 0. The bar must
// therefore never precede the markers — writing it first pushes the marker off
// column 0, Ghostty moves the rest of the row (the userMessageBg band) one line
// down, and the next row write erases it: the block's first row renders
// bar-only, without background. Keeping the markers at line start also lets
// pi-tui's layout strip them again (it only strips a leading zone prefix), and
// should they ever reach a terminal unstripped, a marker at column 0 is a
// no-op fresh-line everywhere that honors it.
const OSC133_ZONE_PREFIX = /^(?:\x1b\]133;[ABC](?:\x07|\x1b\\))+/

interface PatchablePrototype {
  render: (width: number) => string[]
  pinaPristineRender?: (width: number) => string[]
}

let installed = false

export function installUserMessageBorder(
  getCtx: () => ExtensionContext | undefined,
): void {
  const proto = UserMessageComponent?.prototype as
    PatchablePrototype | undefined
  if (installed || typeof proto?.render !== 'function') return
  installed = true
  const pristine = (proto.pinaPristineRender ??= proto.render)
  let lastGoodTheme: Theme | undefined
  proto.render = function (width: number): string[] {
    const lines = pristine.call(this, width)
    let theme = lastGoodTheme
    try {
      const current = getCtx()?.ui.theme
      if (current) {
        theme = current
        lastGoodTheme = current
      }
    } catch {
      // ctx rejected (stale after reload/session replacement): keep last good.
    }
    if (!theme || lines.length === 0) return lines
    const bg = theme.getBgAnsi('userMessageBg')
    const bar = theme.fg('accent', BAR)
    return lines.map((line) => {
      if (!bg || !line.includes(bg)) return line
      const zones = line.match(OSC133_ZONE_PREFIX)?.[0] ?? ''
      const body = zones ? line.slice(zones.length) : line
      return zones + bar + truncateToWidth(body, width - 1, '')
    })
  }
}
