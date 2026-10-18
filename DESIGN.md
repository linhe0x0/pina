# Piña Design System

A platform-agnostic color system for AI coding agent TUIs. Three artifacts, one derivation rule:

- **`DESIGN.md`** (this file) — the spec: principles, tokens, usage.
- **`tokens.json`** — the machine-readable source of every hex value.

## Principles

- **Contrast floor.** Body text keeps ≥ 4.5:1 (WCAG AA) on the surface it renders on. Ratios are
  measured against the dark canvas, `bg-base #101010`.
- **Hue budget.** Syntax spends at most six hues. The brand hue (`primary`, gold family) and the
  alarm hue (`danger`, red family) never collide.
- **Alarm exclusivity.** `danger` is reserved for errors. It never decorates.
- **Naming grammar.** Scene colors are role-named (`primary`, `success`), never hue-named. `text-*`
  encodes text hierarchy, never "a scene color applied to text". `bg-*` encodes elevation above
  the canvas. Role aliases (`bg-emphasis`, `text-emphasis`) point at scene colors, so consumers
  prefer the role name.

## Scene colors

The emotional axis of the UI. Scene colors carry hex values; role names survive re-theming.

| Token            | Hex       | vs bg-base | Usage                                                                                                                                     |
| ---------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`        | `#ffd859` | 13.8       | Brand accent: logo, cursor, inline code (via `text-emphasis`). Also the emphasis surface and search-match chip color (via `bg-emphasis`). |
| `primary-accent` | `#8f762f` | 4.3        | Quiet primary for persistent accents: focused borders, meta badges. The hover-darkened step of `primary`.                                 |

## Palette

Where color words are allowed to live. Most members are syntax hues.

| Token   | Hex       | vs bg-base | Usage                                                                      |
| ------- | --------- | ---------- | -------------------------------------------------------------------------- |
| `white` | `#ffffff` | 19         | Pure anchor; target of `text-white`.                                       |
| `black` | `#000000` | 1.1        | Deep dark anchor. No consumer yet.                                         |
| `blue`  | `#79a8ff` | 8          | Syntax keyword hue; links. Shares the cool hue family of the neutral ramp. |
| `teal`  | `#63cfc9` | 10.2       | Syntax type hue. Keeps syntax at six hues with no amber collision.         |
| `green` | `#52ce63` | 9.4        | Green accent. No consumer yet.                                             |

## Text hierarchy

Four steps of emphasis, brightest first. A token's name is its rank, not its color.

| Token              | Hex        | Contrast                            | Usage                                                                                                                                                                          |
| ------------------ | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text-white`       | `$white`   | 19 on base                          | User input — the brightest text in the system.                                                                                                                                 |
| `text-primary`     | `#e8ebf1`  | 15.9 on base, 7.7 on accent         | Default body: assistant prose, markdown headings.                                                                                                                              |
| `text-secondary`   | `#b0b9c5`  | 9.6 base, 6.1 secondary, 4.7 accent | Supporting information: tool output, link URLs, diff context, syntax functions and code variables; faint borders (code block border).                                          |
| `text-tertiary`    | `#4b5563`  | 2.5 base, 1.6 secondary             | Faintest annotations: code comments, strings and numbers, operators and punctuation, thinking block text, markdown quotes and list bullets, horizontal rules. Never body copy. |
| `text-emphasis`    | `$primary` | 13.8 on base                        | Gold emphasis text on dark surfaces.                                                                                                                                           |
| `text-on-emphasis` | `#101010`  | 13.8 on gold                        | Text on emphasis surfaces: search-match text.                                                                                                                                  |
| `text-link`        | `$blue`    | 8 on base                           | Hyperlink text.                                                                                                                                                                |
| `text-success`     | `#089c65`  | 5.4 on base                         | Success, tool titles, diff additions, code block content, bash mode border.                                                                                                    |
| `text-danger`      | `#f1626a`  | 6.1 base, 5.7 on bg-danger          | Errors, diff removals. 5.7:1 on `bg-danger`.                                                                                                                                   |
| `text-warning`     | `#ffd600`  | 13.5 on base                        | Warnings. Hue-shifted from `primary` (~32° vs ~48°) so the two never read as the same color.                                                                                   |

## Backgrounds

Elevation ladder above the canvas. Every level is a documented contrast step.

| Token                | Hex        | vs bg-base | Usage                                                                                                 |
| -------------------- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `bg-base`            | `#101010`  | —          | The terminal canvas. Baseline for every ratio; user messages render directly on it.                   |
| `bg-primary`         | `#1e2126`  | 1.2        | Standard panel surface above the canvas: editor input area, user messages.                            |
| `bg-secondary`       | `#191b1f`  | 1.1        | Export cards.                                                                                         |
| `bg-tertiary`        | `#14161a`  | 1.1        | Recessed panels: tool execution boxes in pending state.                                               |
| `bg-emphasis`        | `$primary` | 13.8       | Emphasis surfaces: search-match chips.                                                                |
| `bg-emphasis-subtle` | `#442e00`  | 1.5        | Quiet emphasis surface: agent-injected message panels (skill invocations, extension custom messages). |
| `bg-accent`          | `#414853`  | 2.1        | Interactive surfaces: export info panels.                                                             |
| `bg-success`         | `#02180a`  | 1.0        | Success-tinted surface: tool execution boxes in success state.                                        |
| `bg-danger`          | `#360309`  | 1.1        | Error-tinted surface: tool execution boxes in error state.                                            |
| `bg-warning`         | `#442e00`  | 1.5        | Warning-tinted surface.                                                                               |

## Chrome

| Token              | Hex               | vs bg-base | Notes                               |
| ------------------ | ----------------- | ---------- | ----------------------------------- |
| `border-base`      | `#3f4550`         | 2          | Normal borders.                     |
| `border-secondary` | `#30363e`         | 1.6        | Subtle separators; scrollbar track. |
| `border-accent`    | `$primary-accent` | 4.3        | Focused borders, meta badges.       |

## Cognition ramp

AI reasoning intensity, faintest to hottest. Platform concepts map onto the seven steps (pi's
thinking levels Off→Max are `cognition-0`…`cognition-6`).

`cognition-0 #566070` → `1 #6e829c` → `2 #6f9be0` → `3 #9d8cf2` → `4 #c98ef2` → `5 #f18fd2` →
`6 #ff8f6b`

## Syntax roles

How the six-hue budget is spent. Role names are platform-agnostic; adapters translate them
(pi's `syntax*` keys, nvim's `@` groups, Zed's syntax styles).

| Role                  | Token             |
| --------------------- | ----------------- |
| comment               | `$text-tertiary`  |
| keyword               | `$blue`           |
| function              | `$text-secondary` |
| variable              | `$text-secondary` |
| string                | `$text-tertiary`  |
| number                | `$text-tertiary`  |
| type                  | `$teal`           |
| operator, punctuation | `$text-tertiary`  |
