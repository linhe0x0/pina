/**
 * Ghostty drops kitty-graphics images placed shortly after a `CSI 16 t`
 * cell-size query, so every inline image pi renders (tool results, codemode
 * reads) can vanish and leave its reserved rows blank. Measured on Ghostty
 * 1.3.1: a placement transmitted back-to-back with the query fails ~1/3 of
 * the time, and pi's startup flow (query at TUI start, first image frames
 * soon after, re-placed after the reply) fails on essentially every run.
 * Same payload without the query, or ≥1s after it, always renders; placing,
 * deleting, and re-placing well after the query also renders.
 *
 * Workaround: defer the query past the race window. pi-tui sends `CSI 16 t`
 * once in TuiBase.start() and applies the reply through setCellDimensions +
 * invalidate, so delaying the query keeps accurate cell dimensions at the
 * cost of one reflow if an image is on screen during the first seconds.
 * Ghostty-only: pi enables the query only when an image protocol is
 * detected, and the original method keeps that check.
 *
 * Reload safety: /reload re-evaluates this module, so the pristine method is
 * anchored on TuiBase's prototype and every install re-wraps from that
 * anchor — wrappers replace each other instead of stacking.
 */
import { TuiAltScreen } from '@earendil-works/pi-tui'

const DEFER_MS = 2000

interface DeferrableQueryCellSize {
  queryCellSize?: () => void
  stopped?: boolean
}

function isGhostty(): boolean {
  if (process.env.TMUX || process.env.TERM?.startsWith('tmux')) return false
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? ''
  return (
    termProgram === 'ghostty' ||
    process.env.TERM?.includes('ghostty') === true ||
    process.env.GHOSTTY_RESOURCES_DIR !== undefined
  )
}

export function installDeferredCellSizeQuery(): void {
  if (!isGhostty()) return
  // queryCellSize lives on TuiBase; TuiAltScreen's prototype chain exposes it
  // without a deep import into pi-tui internals.
  const base = Object.getPrototypeOf(
    TuiAltScreen.prototype,
  ) as DeferrableQueryCellSize
  if (typeof base?.queryCellSize !== 'function') return
  const pristine =
    (base as { pinaPristineQueryCellSize?: () => void })
      .pinaPristineQueryCellSize ?? (base.queryCellSize as () => void)
  ;(
    base as { pinaPristineQueryCellSize?: () => void }
  ).pinaPristineQueryCellSize = pristine
  base.queryCellSize = function (this: { stopped?: boolean }) {
    setTimeout(() => {
      if (this.stopped) return
      pristine.call(this)
    }, DEFER_MS)
  }
}
