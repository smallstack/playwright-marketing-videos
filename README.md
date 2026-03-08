<p align="center">
  <img src="https://ltmdiiguvlmrsihp.public.blob.vercel-storage.com/logos/playwright-marketing-videos.svg" alt="playwright-marketing-videos" width="120" />
</p>

<h1 align="center">playwright-marketing-videos</h1>

<p align="center">
  Playwright tools for creating polished marketing videos with realistic mouse movements, typing animations, audio voice-overs, AI video overlays, banners, and element highlights.
</p>

<p align="center">
  Drop-in replacement for <code>@playwright/test</code> that automatically enhances every page interaction with smooth, human-like animations — perfect for product demos, feature showcases, and marketing screencasts.
</p>

## Table of Contents

- [Quick Example](#quick-example)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Playwright Config](#playwright-config)
- [API](#api)
  - [test / expect](#test--expect)
  - [showBanner](#showbannerpage-title-options)
  - [highlightElement](#highlightelementpage-locator-options)
  - [moveMouse](#movemousepage-options)
  - [moveMouseInNiceCurve](#movemouseinnicecurvepage-start-end-options)
  - [animatedType](#animatedtypepage-locator-text)
  - [showClickAnimation](#showclickanimationpage-point)
  - [Cursor Management](#cursor-management)
  - [Scroll Animations](#scroll-animations)
- [Audio / Voice-Over](#audio--voice-over)
  - [Kokoro (Default)](#kokoro-default--free--local)
  - [ElevenLabs](#elevenlabs)
  - [generateAudioLayer](#generateaudiolayeroptions)
  - [playAudio](#playaudiopage-audiolayer-waitforaudiotofinish)
  - [Audio Cache](#audio-cache)
  - [Migrating from v0.2.x](#migrating-from-v02x)
- [Video Overlays](#video-overlays)
  - [Runway (Default)](#runway-default-provider)
  - [URL (Pre-existing Videos)](#url-pre-existing-videos)
  - [generateVideoOverlay](#generatevideooverlayoptions)
  - [playVideoOverlay](#playvideooverlaypage-overlay-waitforvideotofinish)
  - [Custom Video Providers](#custom-video-providers)
  - [Video Cache](#video-cache)
- [Examples](#examples)
- [Types](#types)
- [License](#license)

## Quick Example

A minimal example with voice-over narration and a video intro — note how `generateAudioLayer` and `generateVideoOverlay` are called in `beforeAll` so their results are ready before the test runs (the first call may take minutes to download models or generate media):

```ts
import {
  test,
  showBanner,
  generateAudioLayer,
  playAudio,
  generateVideoOverlay,
  playVideoOverlay
} from "playwright-marketing-videos";

let introAudio: Awaited<ReturnType<typeof generateAudioLayer>>;
let introVideo: Awaited<ReturnType<typeof generateVideoOverlay>>;

test.beforeAll(async () => {
  // Pre-generate audio & video so the test itself runs without long pauses.
  // First run downloads an ~86 MB TTS model and generates media — subsequent
  // runs are served from cache in milliseconds.
  introAudio = await generateAudioLayer({
    text: "Welcome to Acme — the fastest way to ship.",
  });

  introVideo = await generateVideoOverlay({
    prompt: "Cinematic zoom into a glowing laptop showing a sleek dashboard",
    durationSec: 5,
  });
});

test("quick product intro", async ({ page }) => {
  await page.goto("https://your-app.com");

  // Play AI-generated video intro
  await playVideoOverlay(page, introVideo);

  // Show a banner with voice-over
  await showBanner(page, "Acme — Ship Faster");
  await playAudio(page, introAudio, true);

  // Interactions are automatically animated (smooth cursor, typing, ripples)
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByLabel("Email").fill("user@example.com");
});
```

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

## Video Overlays

Generate AI video clips from text prompts — or use existing video files from any URL — and play them as full-screen overlays in your marketing videos. Videos are rendered directly in the browser viewport so Playwright's native video recording captures them — no external video editing required.

### Runway (Default Provider)

Set your API key:

```bash
export RUNWAYML_API_KEY="your-api-key-here"
```

```ts
import { generateVideoOverlay, playVideoOverlay } from "playwright-marketing-videos";

const video = await generateVideoOverlay({
  prompt: "A smooth camera fly-through of a modern SaaS dashboard with charts animating in",
  durationSec: 5,       // Video length in seconds (default: 5)
  aspectRatio: "16:9"   // "16:9" (default) or "9:16" for vertical videos
});

await playVideoOverlay(page, video);
```

The default Runway provider uses the **Gen-4 Turbo** model. You can customize the model or API key by providing your own `RunwayVideoProvider` instance:

```ts
import { generateVideoOverlay, RunwayVideoProvider } from "playwright-marketing-videos";

const video = await generateVideoOverlay({
  prompt: "Colorful particles forming a company logo",
  provider: new RunwayVideoProvider({
    model: "gen4_turbo",
    apiKey: "rk-my-specific-key"  // Override the environment variable
  })
});
```

Get an API key at [runwayml.com](https://runwayml.com).

### URL (Pre-existing Videos)

Use `UrlVideoProvider` to download and cache any hosted video file (from a CDN, S3, direct link, etc.) — no AI generation needed:

```ts
import { generateVideoOverlay, playVideoOverlay, UrlVideoProvider } from "playwright-marketing-videos";

const video = await generateVideoOverlay({
  prompt: "Company brand intro",  // Used only for logging/cache key
  provider: new UrlVideoProvider("https://cdn.example.com/videos/brand-intro.mp4")
});

await playVideoOverlay(page, video);
```

The video is downloaded once and cached locally. Subsequent runs with the same URL serve the file from disk instantly.

### `generateVideoOverlay(options)`

Generates a short AI video clip from a text prompt.

| Option | Type | Default | Description |
|---|---|---|---|
| `prompt` | `string` | *required* | Text prompt describing the video to generate |
| `durationSec` | `number` | `5` | Video duration in seconds |
| `aspectRatio` | `"16:9" \| "9:16"` | `"16:9"` | Aspect ratio — use `"9:16"` for vertical/mobile videos |
| `provider` | `VideoProvider` | `RunwayVideoProvider` | Video generation provider instance |

**Returns:** `VideoOverlay` object with `{ filePath, prompt, durationSec }`.

### `playVideoOverlay(page, overlay, waitForVideoToFinish?)`

Plays a video overlay as a full-screen layer on the Playwright page. The video is injected as a base64-encoded `<video>` element that covers the entire viewport.

```ts
// Play video and wait for it to finish (default)
await playVideoOverlay(page, video);

// Play video and continue immediately (e.g. to animate UI beneath)
await playVideoOverlay(page, video, false);
```

### Custom Video Providers

You can implement the `VideoProvider` interface to add support for other video generation APIs (e.g. Kling, Luma, Stability, Pika):

```ts
import type { VideoProvider } from "playwright-marketing-videos";

class MyCustomProvider implements VideoProvider {
  readonly name = "my-provider";

  async generate(options: {
    prompt: string;
    durationSec: number;
    aspectRatio: string;
    cacheDir?: string;
    cacheKey?: string;
  }): Promise<Buffer> {
    // Call your preferred video generation API here
    // Return the video file as a Buffer
    const response = await fetch("https://my-video-api.com/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: options.prompt, duration: options.durationSec })
    });
    return Buffer.from(await response.arrayBuffer());
  }
}

const video = await generateVideoOverlay({
  prompt: "An abstract gradient animation",
  provider: new MyCustomProvider()
});
```

### Video Cache

Generated videos are cached locally in a `__video_cache/` directory (created in the current working directory). Cache keys are SHA-256 hashes of the prompt + duration + aspect ratio + provider name, so:

- Identical requests are served instantly from disk
- Changing the prompt, duration, aspect ratio, or provider generates a new file
- If a generation task times out, the provider can store intermediate state (e.g. pending task IDs) in the cache directory so the next run resumes polling instead of creating a new task
- The cache directory can be safely deleted to regenerate all videos
- Add `__video_cache/` to `.gitignore` if you don't want to commit cached video files, or commit them to avoid regenerating in CI

## Examples

### Full Product Demo with Voice-Over

A complete example combining banners, voice-over narration, UI interactions, and highlights. All audio is pre-generated in `beforeAll` so the test runs smoothly:

```ts
import {
  test,
  expect,
  showBanner,
  generateAudioLayer,
  playAudio,
  highlightElement,
  moveMouse
} from "playwright-marketing-videos";

let intro: Awaited<ReturnType<typeof generateAudioLayer>>;
let narration: Awaited<ReturnType<typeof generateAudioLayer>>;
let templates: Awaited<ReturnType<typeof generateAudioLayer>>;

test.beforeAll(async () => {
  intro = await generateAudioLayer({
    text: "Welcome to Acme — the fastest way to manage your projects.",
  });
  narration = await generateAudioLayer({
    text: "Let me show you how easy it is to create a new project.",
  });
  templates = await generateAudioLayer({
    text: "Choose from dozens of pre-built templates to get started instantly.",
  });
});

test("full product demo", async ({ page }) => {
  await showBanner(page, "Acme — Project Management", {
    duration: 4000,
    callback: async () => {
      await page.goto("https://acme.example.com");
    }
  });

  await playAudio(page, intro, true);

  // Navigate and narrate
  await playAudio(page, narration);

  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill("My First Project");

  // Highlight a key feature
  await highlightElement(page, page.locator(".template-picker"), {
    borderColor: "#4f46e5",
    zoomScale: 1.08
  });

  await playAudio(page, templates, true);

  await page.getByRole("button", { name: "Create" }).click();
});
```

### AI Video Intro with Voice-Over

Use a generated AI video as a cinematic intro before your product walkthrough:

```ts
import {
  test,
  generateVideoOverlay,
  playVideoOverlay,
  generateAudioLayer,
  playAudio,
  showBanner
} from "playwright-marketing-videos";

let introVideo: Awaited<ReturnType<typeof generateVideoOverlay>>;
let narration: Awaited<ReturnType<typeof generateAudioLayer>>;

test.beforeAll(async () => {
  introVideo = await generateVideoOverlay({
    prompt: "Cinematic zoom into a glowing laptop screen showing a beautiful dashboard, soft blue light, professional office background",
    durationSec: 5,
    aspectRatio: "16:9"
  });

  narration = await generateAudioLayer({
    text: "Introducing the next generation of project analytics."
  });
});

test("video intro demo", async ({ page }) => {
  await page.goto("https://your-app.com");

  await playVideoOverlay(page, introVideo);
  await playAudio(page, narration, true);

  // Continue with the product demo
  await showBanner(page, "Real-Time Analytics Dashboard");
  await page.getByRole("link", { name: "Dashboard" }).click();
});
```

### Background Audio While Interacting

Play voice-over narration in the background while performing animated interactions:

```ts
import {
  test,
  generateAudioLayer,
  playAudio,
  moveMouse
} from "playwright-marketing-videos";

let narration: Awaited<ReturnType<typeof generateAudioLayer>>;

test.beforeAll(async () => {
  narration = await generateAudioLayer({
    text: "The settings page gives you full control over notifications, privacy, and appearance.",
  });
});

test("background narration", async ({ page }) => {
  await page.goto("https://your-app.com/settings");

  // Start narration without waiting — it plays while we interact
  await playAudio(page, narration); // no `true` = don't wait

  // These interactions happen while the audio plays
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByLabel("Email alerts").check();
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByLabel("Dark mode").check();
});
```

### Multiple Video Overlays in Sequence

Chain multiple AI-generated video clips to create a story arc:

```ts
import {
  test,
  generateVideoOverlay,
  playVideoOverlay,
  showBanner
} from "playwright-marketing-videos";

let problemVideo: Awaited<ReturnType<typeof generateVideoOverlay>>;
let solutionVideo: Awaited<ReturnType<typeof generateVideoOverlay>>;

test.beforeAll(async () => {
  problemVideo = await generateVideoOverlay({
    prompt: "Frustrated person drowning in spreadsheets and sticky notes, messy desk, overwhelmed expression",
    durationSec: 5
  });
  solutionVideo = await generateVideoOverlay({
    prompt: "Clean modern workspace with a sleek app on screen, person smiling confidently, minimal design",
    durationSec: 5
  });
});

test("multi-scene video", async ({ page }) => {
  await page.goto("https://your-app.com");

  // Scene 1: Problem statement
  await playVideoOverlay(page, problemVideo);
  await showBanner(page, "There's a better way.");

  // Scene 2: Solution reveal
  await playVideoOverlay(page, solutionVideo);
  await showBanner(page, "Meet Acme.", { duration: 3000 });

  // Continue with live product demo...
  await page.getByRole("button", { name: "Get Started" }).click();
});
```

### Pre-existing Video from URL

Use a hosted video file as an overlay — great for brand intros, stock footage, or pre-rendered animations:

```ts
import {
  test,
  generateVideoOverlay,
  playVideoOverlay,
  generateAudioLayer,
  playAudio,
  showBanner,
  UrlVideoProvider
} from "playwright-marketing-videos";

let brandIntro: Awaited<ReturnType<typeof generateVideoOverlay>>;
let narration: Awaited<ReturnType<typeof generateAudioLayer>>;

test.beforeAll(async () => {
  brandIntro = await generateVideoOverlay({
    prompt: "Brand intro video",
    provider: new UrlVideoProvider("https://cdn.example.com/videos/brand-intro.mp4")
  });

  narration = await generateAudioLayer({
    text: "Built by developers, for developers."
  });
});

test("branded intro from URL", async ({ page }) => {
  await page.goto("https://your-app.com");

  await playVideoOverlay(page, brandIntro);
  await playAudio(page, narration, true);

  // Continue with the live product demo
  await showBanner(page, "Let's dive in.");
  await page.getByRole("button", { name: "Get Started" }).click();
});
```

### Vertical Video for Mobile

Create portrait-oriented videos for social media (TikTok, Reels, Shorts):

```ts
import { test, generateVideoOverlay, playVideoOverlay } from "playwright-marketing-videos";
import { defineConfig, devices } from "@playwright/test";

// In your playwright config, use a vertical viewport:
// viewport: { width: 720, height: 1280 }

let video: Awaited<ReturnType<typeof generateVideoOverlay>>;

test.beforeAll(async () => {
  video = await generateVideoOverlay({
    prompt: "Vertical video of a hand swiping through a beautiful mobile app interface",
    durationSec: 5,
    aspectRatio: "9:16"  // Vertical aspect ratio
  });
});

test("mobile promo", async ({ page }) => {
  await page.goto("https://your-app.com/mobile");

  await playVideoOverlay(page, video);
});
```

### ElevenLabs Premium Voice-Over

Use ElevenLabs for higher-quality, multilingual narration:

```ts
import { test, generateAudioLayer, playAudio, showBanner } from "playwright-marketing-videos";

let intro: Awaited<ReturnType<typeof generateAudioLayer>>;

test.beforeAll(async () => {
  intro = await generateAudioLayer({
    provider: "elevenlabs",
    text: "Welcome to the future of productivity. Let us show you what's possible.",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    modelId: "eleven_multilingual_v2"
  });
});

test("premium voice demo", async ({ page }) => {
  await page.goto("https://your-app.com");

  await showBanner(page, "Productivity Reimagined", {
    callback: async () => await page.goto("https://your-app.com/tour")
  });

  await playAudio(page, intro, true);
  await page.getByRole("button", { name: "Start Tour" }).click();
});
```

## Types

All types are exported for use in your own code:

```ts
import type {
  MousePoint,
  MouseTarget,
  AudioLayer,
  VideoOverlay,
  GenerateAudioLayerOptions,
  GenerateVideoOverlayOptions,
  KokoroOptions,
  ShowBannerOptions,
  HighlightElementOptions,
  MoveMouseOptions,
  MoveMouseInNiceCurveOptions,
  VideoProvider,
  UrlVideoProvider
} from "playwright-marketing-videos";
```

## License

MIT
