export function bgToFg(ansi: string): string {
  return ansi
    .replace(/\x1b\[48;/g, '\x1b[38;')
    .replace(
      /\x1b\[(4|10)([0-7])m/g,
      (_, p: string, n: string) => `\x1b[${p === '4' ? '3' : '9'}${n}m`,
    )
}

export function truecolorFg(hex: string): string {
  return `\x1b[38;2;${[1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16))
    .join(';')}m`
}
