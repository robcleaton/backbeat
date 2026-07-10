---
name: halftone-video
description: Apply a live black/white halftone dot-screen effect to a video element via a canvas overlay, with play/pause and mute controls. Use when asked to add a halftone, dot-screen, Ben-Day dot, or newspaper-print effect to a video, or to reproduce the brik.space-style halftone look.
---

# Halftone video effect

Renders a `<video>` through a canvas every frame: downsample the frame to a
small grid, draw one circle per cell sized by that cell's brightness. Bright
areas get large/near-solid white dots, dark areas get small or no dots. Fully
live — audio and the dot pattern track the video in real time, not a
pre-baked filter.

## HTML structure

```html
<div class="halftone-tile" id="halftone-tile" style="cursor:pointer;">
    <video id="source-video" src="video.mp4" autoplay muted loop playsinline preload="auto"></video>
    <canvas id="halftone-canvas"></canvas>

    <!-- center play indicator, shown only when paused -->
    <div id="play-indicator" class="absolute inset-0 flex items-center justify-center pointer-events-none" style="display:none;">
        <div class="bg-black/40 backdrop-blur-sm rounded-full p-5">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
    </div>

    <!-- mute toggle, independent of play/pause -->
    <button id="mute-btn" type="button" aria-label="Unmute"
            style="position:absolute;bottom:20px;right:20px;background:none;border:none;cursor:pointer;padding:0;">
        <div class="bg-black/40 backdrop-blur-sm rounded-full p-2.5">
            <svg id="icon-muted" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><!-- muted-speaker path --></svg>
            <svg id="icon-sound" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:none"><!-- speaker path --></svg>
        </div>
    </button>
</div>
```

## CSS

```css
.halftone-tile { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 1.5rem; overflow: hidden; background: #000; }
/* Video sits behind the canvas, NOT display:none — see gotcha #1 below. */
#source-video  { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
#halftone-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
```

## JS: renderer

```js
const video = document.getElementById('source-video');
const canvas = document.getElementById('halftone-canvas');
const ctx = canvas.getContext('2d');

const COLS = 110;           // dot columns; tune density here
let rows = 0;

const sample = document.createElement('canvas');           // offscreen downsample target
const sampleCtx = sample.getContext('2d', { willReadFrequently: true });

function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    rows = Math.max(1, Math.round(COLS * (canvas.height / canvas.width)));
    sample.width = COLS;
    sample.height = rows;
}
window.addEventListener('resize', resize);
resize();

function renderFrame() {
    requestAnimationFrame(renderFrame);
    if (video.readyState < 2 || !canvas.width) return;

    // drawImage does the downsample/averaging for free — no manual pixel loop needed.
    sampleCtx.drawImage(video, 0, 0, sample.width, sample.height);
    const { data } = sampleCtx.getImageData(0, 0, sample.width, sample.height);

    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / COLS;
    const cellH = canvas.height / rows;
    const maxRadius = Math.min(cellW, cellH) * 0.5 * 0.94;   // small gap so dots don't fully merge

    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < COLS; x++) {
            const i = (y * COLS + x) * 4;
            const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
            const radius = lum * maxRadius;
            if (radius < 0.5) continue;
            ctx.beginPath();
            ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

video.play().catch(() => {});   // belt-and-braces; `autoplay` attribute usually suffices
requestAnimationFrame(renderFrame);
```

## JS: play/pause + mute controls

Click the tile to play/pause (freezes/resumes audio and dots together — no
special-case needed, the canvas just keeps redrawing whatever frame the
paused video is sitting on). Mute is a separate control, independent of
play state, and the first tile click also auto-unmutes:

```js
const tile = document.getElementById('halftone-tile');
const playIndicator = document.getElementById('play-indicator');
const muteBtn = document.getElementById('mute-btn');
const iconMuted = document.getElementById('icon-muted');
const iconSound = document.getElementById('icon-sound');

let hasInteracted = false;
function firstUnmute() {
    if (hasInteracted) return;
    hasInteracted = true;
    video.muted = false;
    video.volume = 0.8;
    iconMuted.style.display = 'none';
    iconSound.style.display = 'block';
    muteBtn.setAttribute('aria-label', 'Mute');
}

tile.addEventListener('click', (e) => {
    if (e.target.closest('#mute-btn')) return;
    firstUnmute();
    if (video.paused) {
        video.play();
        playIndicator.style.display = 'none';
    } else {
        video.pause();
        playIndicator.style.display = 'flex';
    }
});

muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.muted || video.volume === 0) {
        video.muted = false;
        video.volume = 0.8;
        iconMuted.style.display = 'none';
        iconSound.style.display = 'block';
        muteBtn.setAttribute('aria-label', 'Mute');
    } else {
        video.muted = true;
        iconMuted.style.display = 'block';
        iconSound.style.display = 'none';
        muteBtn.setAttribute('aria-label', 'Unmute');
    }
});
```

Start the page with `video` `autoplay muted loop playsinline` so the dots
animate immediately on load (silently) instead of showing a static/black
first frame. Initialize the mute icon to the muted state and the play
indicator hidden, to match.

## Gotchas (hard-won)

1. **Never `display:none` the `<video>`.** Safari (and some Chrome
   configurations) throttle or stop decoding video that isn't in the render
   tree, even though a canvas is reading from it every frame — this
   produces a black canvas with no errors. Keep the video in normal layout
   flow, positioned behind the opaque canvas instead (`position:absolute`,
   same size, canvas painted after it in DOM order or via `z-index`).

2. **Don't rely solely on the `canplay` event to kick off the render loop.**
   Start `requestAnimationFrame(renderFrame)` unconditionally on script
   load and guard on `video.readyState < 2` inside the loop instead — more
   robust across browsers/timing.

3. **Local dev servers need HTTP Range support for `<video>`.** Python's
   built-in `python3 -m http.server` returns `200 OK` for the whole file
   even when a `Range` header is sent, instead of `206 Partial Content`.
   Large video files then fail to buffer/seek reliably in the browser
   (symptom: video never reaches `readyState >= 2`, canvas stays black).
   Fix: `pip install rangehttpserver` then `python3 -m RangeHTTPServer
   <port>`. Verify with:
   `curl -s -D - -o /dev/null -H "Range: bytes=0-1023" <url>` — look for
   `206 Partial Content` and an `Accept-Ranges: bytes` header. Static
   hosts used in production (GitHub Pages, Netlify, etc.) already support
   Range requests correctly — this only bites local testing.

4. **Downsample via `drawImage` onto a tiny canvas, don't hand-loop
   pixels.** Drawing the full-res video into a `COLS`×`ROWS` canvas gets
   you free hardware-accelerated averaging per cell — much cheaper and
   simpler than sampling the full-resolution frame yourself.

5. **Cap devicePixelRatio (e.g. `Math.min(dpr, 2)`).** Uncapped DPR on a
   4K/5K display makes the canvas and per-frame `getImageData` calls much
   more expensive for no visible benefit at typical viewing distance.

## Verifying headlessly

There's no GUI in this environment, so drive headless Chrome via CDP to
confirm the effect actually renders and the controls actually work —
don't just eyeball the code:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9333 --remote-allow-origins=* \
  --window-size=1400,1000 --autoplay-policy=no-user-gesture-required \
  about:blank &
```

Then use a small Python script (see conversation history / reuse pattern)
with `websocket` + `requests` to: `Page.navigate`, wait for
`Page.loadEventFired`, `Runtime.evaluate` JS expressions to click controls
and read back `video.paused` / `video.muted` / `video.currentTime` as JSON,
and `Page.captureScreenshot` to visually confirm the dot pattern. This
catches both logic bugs (state machine wrong) and rendering bugs (black
screen) that reading the source code alone won't.
