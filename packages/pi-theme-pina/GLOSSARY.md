# Piña

A TUI experience package for Pi: the pina-dark theme plus UI extensions that reshape the agent's terminal interface.

## Language

**Artifact**:
A recognizable token in prose — file path, commit, date, duration, IP — that can be chipped.
_Avoid_: token, entity

**Chip**:
A neutral-toned pill wrapping an artifact.
_Avoid_: highlight

**Host**:
Pi, the coding agent whose TUI this package reshapes; it supplies the extension API, the factories, and the runtime theme.
_Avoid_: runtime, app, core

**Panel**:
A full-width recessed surface painted behind content: left accent bar, background reapplied across the row, half-block edge rows above and below.
_Avoid_: chrome, frame, surface

**Pill**:
A rounded inline label carrying a status tone and an icon.
_Avoid_: badge, tag

**PinaConfig**:
The full set of user knobs Piña supports, resolved from environment defaults.
_Avoid_: options bag, settings

**Theme source**:
The theme a component paints with right now: the host's live theme when reachable, otherwise the last one that was, and nothing before the first theme is seen.
_Avoid_: currentTheme, lastGoodTheme, theme getter

**Transformer router**:
Maps each incoming message stream to its transform; unknown streams pass through untouched.
_Avoid_: dispatcher, switch
