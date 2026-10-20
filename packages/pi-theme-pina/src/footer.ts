/**
 * Footer replacement that mirrors pi's built-in FooterComponent minus the model
 * segment: PinaEditor renders "(provider) model • level" inside the input panel
 * instead, so the built-in footer would show the same string twice. The rest
 * follows FooterComponent.render (pi's
 * dist/modes/interactive/components/footer.js) for extension statuses.
 *
 * Intentional divergence: the left side is the location: repo-root name + git
 * branch + cwd relative to the repo root (full paths are noise), falling back
 * to the home-abbreviated cwd outside a repo. The right side is "1% (10k)
 * $0.42" — context percentage colored by usage, current context tokens from
 * the same getContextUsage() source (not the cumulative session total), and
 * cumulative session cost, hidden while zero. Too narrow, it shrinks the
 * location right-to-left: dir, then branch, then repo. Session name is dropped
 * per this layout.
 *
 * Dropped rather than faked — pi does not export these from the extension API:
 * - "(sub)": pi checks an internal OAuth subscription flag on the model
 *   runtime; extensions cannot see it.
 * - " • xp": the experimental-features check is not exported.
 * - The routed virtual-model suffix, like in the editor's segment.
 */
import { existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth, type TUI } from '@earendil-works/pi-tui'
import { PAD_X } from './editor.ts'

/** Footer text aligns with the editor text: the bar column + editor paddingX. */
const PAD_LEFT = 1 + PAD_X

function formatTokens(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1000000) return `${Math.round(count / 1000)}k`
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`
  return `${Math.round(count / 1000000)}M`
}

function formatCwdForFooter(cwd: string): string {
  const home = process.env.HOME || process.env.USERPROFILE
  if (!home) return cwd
  const resolvedCwd = resolve(cwd)
  const resolvedHome = resolve(home)
  const relativeToHome = relative(resolvedHome, resolvedCwd)
  const isInsideHome =
    relativeToHome === '' ||
    (relativeToHome !== '..' &&
      !relativeToHome.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToHome))
  if (!isInsideHome) return cwd
  return relativeToHome === '' ? '~' : `~${sep}${relativeToHome}`
}

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

/** Cumulative session cost, cached like FooterComponent caches its scan. */
type SessionStats = {
  sessionId: string
  leafId: string
  entryCount: number
  cost: number
}

export class PinaFooter {
  private readonly footerData: ReadonlyFooterDataProvider
  private readonly getCtx: () => ExtensionContext
  private readonly tui: TUI
  private readonly unsub: () => void
  private stats: SessionStats | undefined
  private gitRootCache: { cwd: string; root: string | null } | undefined

  constructor(
    tui: TUI,
    getCtx: () => ExtensionContext,
    footerData: ReadonlyFooterDataProvider,
  ) {
    this.tui = tui
    this.getCtx = getCtx
    this.footerData = footerData
    // The branch appears and disappears without keystrokes or events.
    this.unsub = footerData.onBranchChange(() => tui.requestRender())
  }

  invalidate(): void {}

  dispose(): void {
    this.unsub()
  }

  render(width: number): string[] {
    const ctx = this.getCtx()
    const theme = ctx.ui.theme
    const lines: string[] = []

    // One line: location on the left, context stats right-aligned on the same
    // row, indented to the editor text column. The model segment lives in
    // PinaEditor's status row.
    const inner = Math.max(0, width - PAD_LEFT)
    const stats = this.statsLine(ctx, theme)
    // Shrink the location first; the stats keep their context-percentage colors.
    const location = truncateToWidth(
      this.locationLine(ctx, theme),
      Math.max(0, inner - visibleWidth(stats) - 1),
      theme.fg('dim', '...'),
    )
    const gap = ' '.repeat(
      Math.max(1, inner - visibleWidth(stats) - visibleWidth(location)),
    )
    lines.push(
      ' '.repeat(PAD_LEFT) + truncateToWidth(location + gap + stats, inner, '...'),
    )

    // Extension statuses on a single line, sorted by key alphabetically.
    const statuses = this.footerData.getExtensionStatuses()
    if (statuses.size > 0) {
      const statusLine = Array.from(statuses.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => sanitizeStatusText(text))
        .join(' ')
      lines.push(
        ' '.repeat(PAD_LEFT) +
          truncateToWidth(statusLine, Math.max(0, width - PAD_LEFT), theme.fg('dim', '...')),
      )
    }
    // Trailing blank line as bottom padding.
    lines.push('')
    return lines
  }

  private statsLine(ctx: ExtensionContext, theme: Theme): string {
    const parts: string[] = []

    // Context percentage in text-primary, escalating to warning/error at high
    // usage like the built-in footer.
    const percent = ctx.getContextUsage()?.percent
    if (percent !== null && percent !== undefined) {
      const display = `${Math.round(percent)}%`
      parts.push(
        percent > 90
          ? theme.fg('error', display)
          : percent > 70
            ? theme.fg('warning', display)
            : theme.fg('text', display),
      )
    }

    // Current context tokens — same source as the percentage, so the pair stays
    // coherent (and resets after compaction) unlike a cumulative total.
    const contextTokens = ctx.getContextUsage()?.tokens
    if (contextTokens) {
      parts.push(theme.fg('dim', `(${formatTokens(contextTokens)})`))
    }

    const cost = this.sessionStats(ctx).cost
    if (cost) parts.push(theme.fg('dim', `$${cost.toFixed(2)}`))

    // Each part embeds its own color and reset, so no whole-line wrap.
    return parts.join(' ')
  }

  /** Repo-root name, branch, and cwd relative to the root. */
  private locationLine(ctx: ExtensionContext, theme: Theme): string {
    const cwd = ctx.sessionManager.getCwd()
    const root = this.gitRoot(cwd)
    if (!root) return theme.fg('dim', formatCwdForFooter(cwd))

    const branch = this.footerData.getGitBranch()
    const relCwd = relative(resolve(root), resolve(cwd))
    // The ⎇ glyph doubles as the separator between repo and branch.
    let out = theme.fg('text', basename(root))
    if (branch) out += ` ${theme.fg('accent', `⎇ ${branch}`)}`
    if (relCwd && relCwd !== '.') out += ` ${theme.fg('dim', `· ${relCwd}`)}`
    return out
  }

  /** Nearest ancestor directory containing `.git`. Cached per cwd. */
  private gitRoot(cwd: string): string | null {
    const cached = this.gitRootCache
    if (cached?.cwd === cwd) return cached.root
    let root: string | null = null
    let dir = resolve(cwd)
    for (;;) {
      if (existsSync(`${dir}${sep}.git`)) {
        root = dir
        break
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    this.gitRootCache = { cwd, root }
    return root
  }

  private sessionStats(ctx: ExtensionContext): SessionStats {
    const sessionManager = ctx.sessionManager
    const sessionId = sessionManager.getSessionId() ?? ''
    const leafId = sessionManager.getLeafId() ?? ''
    const entries = sessionManager.getEntries()
    const cached = this.stats
    if (
      cached &&
      cached.sessionId === sessionId &&
      cached.leafId === leafId &&
      cached.entryCount === entries.length
    ) {
      return cached
    }
    const stats: SessionStats = {
      sessionId,
      leafId,
      entryCount: entries.length,
      cost: 0,
    }
    for (const entry of entries) {
      if (entry.type === 'usage') {
        addUsage(stats, entry.usage)
      } else if (
        entry.type === 'message' &&
        entry.message.role === 'assistant'
      ) {
        addUsage(stats, entry.message.usage)
      } else if (
        entry.type === 'message' &&
        entry.message.role === 'toolResult' &&
        entry.message.usage
      ) {
        addUsage(stats, entry.message.usage)
      } else if (
        (entry.type === 'branch_summary' || entry.type === 'compaction') &&
        entry.usage
      ) {
        addUsage(stats, entry.usage)
      }
    }
    this.stats = stats
    return stats
  }
}

function addUsage(
  stats: SessionStats,
  usage: { cost: { total: number } },
): void {
  stats.cost += usage.cost.total
}
