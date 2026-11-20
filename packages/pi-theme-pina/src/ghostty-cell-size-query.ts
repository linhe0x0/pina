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
