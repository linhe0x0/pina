# Known issues

<details>
<summary><strong>Double-spaced scrollback after exit</strong></summary>

Pi itself (not Piña) repaints the transcript into the terminal scrollback when
exiting fullscreen mode. That exit dump pads every line to the full terminal
width and writes it with autowrap enabled, so when the terminal's real render
grid is one or more columns narrower than the width Pi measured (scrollbar
visible, window resized mid-session, …), every padded line wraps its last cell
onto an extra row and the whole screen looks double-spaced.

Confirmed reproducible in [Herdr](https://github.com/herdrdev/herdr).

Upstream: [pi#9828](https://github.com/earendil-works/pi/issues/9828),
[pi#10710](https://github.com/earendil-works/pi/issues/10710).

Workaround until it is fixed upstream:

```json
{
  "fullscreenExitOutput": "resume-hint"
}
```

Pi then prints only the session resume hint on exit instead of repainting the
transcript. Trade-off: the transcript is no longer copied into scrollback; use
`ctrl+o` inside Pi to browse it.

</details>

<details>
<summary><strong>Blank space instead of inline images on Ghostty</strong></summary>

When a tool returns an image (for example `read` on a PNG), Pi reserves terminal
rows for a kitty-graphics preview below the tool message. On Ghostty those rows
show up blank: Ghostty 1.3.1 drops a kitty-graphics placement that is
transmitted shortly after the `CSI 16 t` cell-size query Pi sends at TUI
startup, and Pi's startup flow (query, then first image frames, then
re-placing the image after the reply) loses the race on essentially every run.
The result is a large empty area under the tool message instead of the image.

Minimal repro (Ghostty 1.3.1, macOS): emit `CSI 16 t`, then immediately a kitty
placement (`\e_Ga=T,f=100,q=2,C=1,c=60,r=19;<png>\e\\`). The image is missing
roughly one run in three; Pi's real-world sequence fails near-always. The same
payload without the query, or one second after it, always renders.

Piña ships a workaround: `src/ghostty-cell-size-query.ts` defers Pi's cell-size
query by two seconds on Ghostty, past the race window. Pi then applies the
reply through its normal re-render path, which renders correctly. Cost: if an
image is on screen during Pi's first two seconds (resumed sessions), it
re-renders once when the reply arrives. The workaround only touches Ghostty;
other terminals keep the immediate query.

Manual fallbacks: set `PI_IMAGE_PROTOCOL=none` or
`"terminal": { "showImages": false }` to render text placeholders instead of
images.

Upstream: report to [Ghostty](https://github.com/ghostty-org/ghostty) (query
races with graphics placement) and
[pi](https://github.com/earendil-works/pi) (query timing / re-place flow).

</details>
