# playwright-marketing-videos

Playwright tools for creating polished marketing videos with realistic mouse movements, typing animations, audio voice-overs, banners, and element highlights.

Drop-in replacement for `@playwright/test` that automatically enhances every page interaction with smooth, human-like animations — perfect for product demos, feature showcases, and marketing screencasts.

## Installation

```bash
npm install playwright-marketing-videos
```

> **Peer dependency:** `@playwright/test` >= 1.40.0 must be installed in your project.

## Quick Start

Replace your usual `@playwright/test` import with this package:

```ts
import { test, expect, showBanner, generateAudioLayer, playAudio } from "playwright-marketing-videos";

test("product demo", async ({ page }) => {
  await page.goto("https://your-app.com");

  // Show a title banner with fade-in/out
  await showBanner(page, "My Awesome Feature");

  // All interactions are now automatically animated:
  // - Mouse moves in smooth bezier curves
  // - Clicks show ripple effects
  // - Typing is character-by-character with realistic timing
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByLabel("Email").fill("user@example.com");
});
```

## Playwright Config

Create a dedicated Playwright config for marketing videos:

```ts
// playwright.marketing.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "**/*.marketing-video.ts",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 },
    video: {
      mode: "on",
      size: { width: 1280, height: 720 }
    },
    screenshot: "off",
    locale: "en-US"
  },
  timeout: 120_000,
  outputDir: "marketing-videos"
});
```

Run with:

```bash
npx playwright test --config playwright.marketing.config.ts
```

## API

### `test` / `expect`

Extended Playwright test fixture. When you use `test` from this package, all page locator methods (`click`, `fill`, `locator`, `getByRole`, `getByText`, `getByTestId`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`) are automatically wrapped with marketing animations:

- **Clicks** move the cursor in a smooth curve to the target, show a ripple animation, then click.
- **Fill/type** moves the cursor, shows a click animation, then types character-by-character with realistic timing (50-150ms per keystroke).
- **Scrolling** is handled automatically with a scroll indicator animation when elements are off-screen.

The cursor icon changes contextually: arrow (default), pointer (over buttons/links), text cursor (over inputs).

### `showBanner(page, title, options?)`

Displays a full-screen banner overlay with fade-in/out animations.

```ts
await showBanner(page, "Feature Showcase", {
  duration: 3000,        // Display duration in ms (default: 2000)
  fadeInMs: 500,         // Fade-in duration (default: 300)
  fadeOutMs: 500,        // Fade-out duration (default: 300)
  backgroundColor: "#1e212b", // Background color (default: "#1e212b")
  textColor: "#ffffff",  // Text color (default: "#ffffff")
  fontSize: "48px",      // Font size (default: "48px")
  callback: async () => {
    // Optional: runs while the banner is shown (e.g. navigate to a page)
    await page.goto("https://your-app.com");
  }
});
```

When a `callback` is provided, the banner is injected before the callback runs and persists across page navigations (re-injected on every `load` event). This is useful for showing a banner during a page transition.

### `highlightElement(page, locator, options?)`

Highlights a page element with a zoom-in effect and colored border.

```ts
await highlightElement(page, page.locator(".feature-card"), {
  duration: 2000,         // How long the highlight stays (default: 2000)
  borderColor: "#ff6b35", // Highlight border color (default: "#ff6b35")
  borderWidth: 4,         // Border width in px (default: 4)
  zoomScale: 1.05         // Zoom factor (default: 1.05)
});
```

### `moveMouse(page, options)`

Moves the visible cursor in a smooth bezier curve to a target.

```ts
// Move to a locator (auto-scrolls into view)
await moveMouse(page, { to: page.getByText("Click me") });

// Move to specific coordinates
await moveMouse(page, { to: { x: 500, y: 300 } });

// Move from a specific starting point
await moveMouse(page, {
  from: { x: 100, y: 100 },
  to: page.getByRole("button"),
  durationMs: 1000
});
```

### `moveMouseInNiceCurve(page, start, end, options?)`

Lower-level function for moving between two specific points with bezier curves.

```ts
await moveMouseInNiceCurve(page, { x: 0, y: 0 }, { x: 500, y: 400 }, {
  durationMs: 800,  // Animation duration (auto-calculated from distance if omitted)
  steps: 60,        // Number of interpolation steps (auto-calculated if omitted)
  seed: 42          // Deterministic randomness seed for reproducible curves
});
```

### `animatedType(page, locator, text)`

Types text character-by-character with realistic timing. Moves the cursor to the field, clicks to focus, then types with 50-150ms delays between keystrokes.

```ts
await animatedType(page, page.getByLabel("Search"), "playwright marketing");
```

### `showClickAnimation(page, point)`

Shows a ripple effect at the given coordinates. Used internally by the `click` wrapper, but available for manual use.

```ts
await showClickAnimation(page, { x: 640, y: 360 });
```

### Cursor Management

```ts
import { addVisibleCursor, hideCursor, showCursor, updateCursorPosition } from "playwright-marketing-videos";

await addVisibleCursor(page);           // Inject the visible cursor (called automatically by test fixture)
await hideCursor(page);                 // Temporarily hide the cursor
await showCursor(page);                 // Show the cursor again
await updateCursorPosition(page, 100, 200); // Manually set cursor position
```

### Scroll Animations

```ts
import { showScrollAnimation, hideScrollAnimation } from "playwright-marketing-videos";

await showScrollAnimation(page);  // Show a mouse-scroll indicator near the cursor
await hideScrollAnimation(page);  // Remove the scroll indicator
```

## Audio / Voice-Over

Generate text-to-speech audio files and play them in your marketing videos. Two TTS providers are supported:

- **Kokoro** (default) — free, local, high-quality neural TTS via [kokoro-js](https://www.npmjs.com/package/kokoro-js). No API key needed.
- **ElevenLabs** — cloud-based TTS with premium voices. Requires an API key.

### Kokoro (Default — Free & Local)

Install the Kokoro package:

```bash
npm install kokoro-js
```

```ts
// Default provider — no API key needed!
// First call downloads an ~86MB model (cached after that)
const audio = await generateAudioLayer({
  text: "Welcome to our product demo!",
  voice: "af_sky",  // Optional (default: "af_heart")
});

await playAudio(page, audio, true);
```

Available options:

- `voice` — Kokoro voice ID (default: `"af_heart"`)
- `dtype` — Model precision: `"fp32"`, `"q8"`, `"q4"` (default: `"q8"`)
- `modelId` — HuggingFace model ID (default: `"onnx-community/Kokoro-82M-v1.0-ONNX"`)

### ElevenLabs

Install the ElevenLabs package and set your API key:

```bash
npm install @elevenlabs/elevenlabs-js
export ELEVENLABS_API_KEY="your-api-key-here"
```

```ts
const audio = await generateAudioLayer({
  provider: "elevenlabs",
  text: "Welcome to our product demo!",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  modelId: "eleven_multilingual_v2"  // Optional (this is the default)
});

await playAudio(page, audio, true);
```

Get an API key at [elevenlabs.io](https://elevenlabs.io).

### `generateAudioLayer(options)`

Generates an audio file from text using the configured TTS provider.

**Returns:** `AudioLayer` object with `{ filePath, text, voiceId? }`.

### `playAudio(page, audioLayer, waitForAudioToFinish?)`

Injects the generated audio into the page and plays it.

```ts
// Play audio and continue immediately
await playAudio(page, audio);

// Or wait for audio to finish before continuing
await playAudio(page, audio, true);
```

### Audio Cache

Generated audio files are cached locally in an `__audio_cache/` directory (created in the current working directory). Cache keys are SHA-256 hashes of the provider configuration, so:

- Identical requests are served instantly from disk
- Changing the text, voice, or model generates a new file
- The cache directory can be safely deleted to regenerate all audio
- Add `__audio_cache/` to `.gitignore` if you don't want to commit cached audio files, or commit them to avoid regenerating in CI

### Migrating from v0.2.x

If you were using ElevenLabs (the previous default), add `provider: "elevenlabs"` to your `generateAudioLayer()` calls:

```ts
// Before (v0.2.x)
const audio = await generateAudioLayer({ text: "Hello", voiceId: "..." });

// After (v0.3.x)
const audio = await generateAudioLayer({ provider: "elevenlabs", text: "Hello", voiceId: "..." });
```

## Types

All types are exported for use in your own code:

```ts
import type {
  MousePoint,
  MouseTarget,
  AudioLayer,
  GenerateAudioLayerOptions,
  KokoroOptions,
  ShowBannerOptions,
  HighlightElementOptions,
  MoveMouseOptions,
  MoveMouseInNiceCurveOptions
} from "playwright-marketing-videos";
```

## License

MIT
