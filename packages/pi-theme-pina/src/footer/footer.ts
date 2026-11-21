import { existsSync } from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'
import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth, type TUI } from '@earendil-works/pi-tui'
import { createThemeSource } from '../theme/theme-source.ts'
import { PAD_X } from '../panel/editor.ts'

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

type SessionStats = {
  sessionId: string
  leafId: string
  entryCount: number
  cost: number
}

export class PinaFooter {
  private readonly footerData: ReadonlyFooterDataProvider
  private readonly getCtx: () => ExtensionContext
  private readonly themeSource: () => Theme | undefined
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
    this.themeSource = createThemeSource(getCtx)
    this.unsub = footerData.onBranchChange(() => tui.requestRender())
  }

  invalidate(): void {}

  dispose(): void {
    this.unsub()
  }

  render(width: number): string[] {
    const ctx = this.getCtx()
    const theme = this.themeSource() as Theme
    const lines: string[] = []

    const inner = Math.max(0, width - PAD_LEFT)
    const stats = this.statsLine(ctx, theme)
    const location = truncateToWidth(
      this.locationLine(ctx, theme),
      Math.max(0, inner - visibleWidth(stats) - 1),
      theme.fg('dim', '...'),
    )
    const gap = ' '.repeat(
      Math.max(1, inner - visibleWidth(stats) - visibleWidth(location)),
    )
    lines.push(
      ' '.repeat(PAD_LEFT) +
        truncateToWidth(location + gap + stats, inner, '...'),
    )

    const statuses = this.footerData.getExtensionStatuses()
    if (statuses.size > 0) {
      const statusLine = Array.from(statuses.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => sanitizeStatusText(text))
        .join(' ')
      lines.push(
        ' '.repeat(PAD_LEFT) +
          truncateToWidth(
            statusLine,
            Math.max(0, width - PAD_LEFT),
            theme.fg('dim', '...'),
          ),
      )
    }
    lines.push('')
    return lines
  }

  private statsLine(ctx: ExtensionContext, theme: Theme): string {
    const parts: string[] = []

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

    const contextTokens = ctx.getContextUsage()?.tokens
    if (contextTokens) {
      parts.push(theme.fg('dim', `(${formatTokens(contextTokens)})`))
    }

    const cost = this.sessionStats(ctx).cost
    if (cost) parts.push(theme.fg('dim', `$${cost.toFixed(2)}`))

    return parts.join(' ')
  }

  private locationLine(ctx: ExtensionContext, theme: Theme): string {
    const cwd = ctx.sessionManager.getCwd()
    const root = this.gitRoot(cwd)
    if (!root) return theme.fg('dim', formatCwdForFooter(cwd))

    const branch = this.footerData.getGitBranch()
    const relCwd = relative(resolve(root), resolve(cwd))
    let out = theme.fg('text', basename(root))
    if (branch) out += ` ${theme.fg('accent', `⎇ ${branch}`)}`
    if (relCwd && relCwd !== '.') out += ` ${theme.fg('dim', `· ${relCwd}`)}`
    return out
  }

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
