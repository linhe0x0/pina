# Piña 🍍

**Pi Agent, but make it pretty.**

A TUI experience package for [Pi](https://pi.dev/): a polished color system plus UI
extensions that reshape the interface itself.

Less eyesore. More eye candy. Same Pi.

## Why Piña?

Because Pi deserves a little tropical vacation, too.

## What's inside

- 🎨 `pina-dark` — a calm, layered dark theme; every color specified and measured
  in [DESIGN.md](../../DESIGN.md)
- 🧩 UI extensions that customize the TUI chrome, loaded through a single extension
  entry — disable it in `pi config` to keep the colors only

## Install

```bash
pi install npm:pi-theme-pina   # npm
pi install git:github.com/linhe0x0/pi-theme-pina   # git
pi install ./pi-theme-pina     # local checkout
```

## Usage

Open `/settings` in Pi and select **Theme** → `pina-dark`, or set it directly:

```json
{
  "theme": "pina-dark"
}
```

Extensions shipped by the package load automatically.

## Development

```bash
make install   # register this repo as a pi package: themes + extensions, live
make check     # theme schema validation + typecheck
make help      # list all targets
```

## License

MIT. Go make Pi pretty.
