import { execFile } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import {
	test as base,
	type Disposable,
	expect,
	type Locator,
	type Page
} from "@playwright/test";

const execFileAsync = promisify(execFile);

// ============================================================================
// Types
// ============================================================================

export type MousePoint = { x: number; y: number };

export type MouseTarget = MousePoint | Locator;

export type AudioLayer = {
	filePath: string;
	text: string;
	voiceId?: string;
};

export type KokoroOptions = {
	voice?: string;
	dtype?: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
	modelId?: string;
};

export type GenerateAudioLayerOptions =
	| ({ provider?: "kokoro"; text: string; cacheDir?: string } & KokoroOptions)
	| {
			provider: "elevenlabs";
			text: string;
			voiceId: string;
			modelId?: string;
			cacheDir?: string;
	  };

export type ShowBannerOptions = {
	duration?: number;
	fadeInMs?: number;
	fadeOutMs?: number;
	fadeOut?: boolean;
	backgroundColor?: string;
	textColor?: string;
	fontSize?: string;
	text: string;
	logoUrl?: string;
	logoText?: string;
	callback?: () => Promise<void>;
};

export type HighlightElementOptions = {
	duration?: number;
	borderColor?: string;
	borderWidth?: number;
	zoomScale?: number;
};

export type MoveMouseOptions = {
	to: MouseTarget;
	from?: MouseTarget;
	durationMs?: number;
	steps?: number;
	seed?: number;
};

export type MoveMouseInNiceCurveOptions = {
	durationMs?: number;
	steps?: number;
	seed?: number;
};

// ---- Video Overlay Types ----

export type VideoOverlay = {
	filePath: string;
	prompt: string;
	durationSec: number;
};

export type GenerateVideoOverlayOptions = {
	prompt: string;
	durationSec?: number;
	aspectRatio?: "16:9" | "9:16";
	provider?: VideoProvider;
	cacheDir?: string;
};

/**
 * Provider interface for AI video generation services.
 * Implement this to add support for additional video generation APIs
 * (e.g. Kling, Luma, Stability, Pika).
 */
export interface VideoProvider {
	readonly name: string;
	generate(options: {
		prompt: string;
		durationSec: number;
		aspectRatio: string;
		/** Directory used for caching — providers can store intermediate state here (e.g. pending task IDs). */
		cacheDir?: string;
		/** Unique hash key for this request — useful for naming state files. */
		cacheKey?: string;
	}): Promise<Buffer>;
}

// ---- Timeline types ----

type TimelineSegmentBase = {
	id: string;
	/** Fade-in transition duration in ms (applied during compose) */
	fadeInMs?: number;
	/** Fade-out transition duration in ms (applied during compose) */
	fadeOutMs?: number;
};

export type ScreencastSegment = TimelineSegmentBase & {
	type: "screencast";
	videoPath: string;
	audio?: AudioLayer;
	durationMs?: number;
};

export type BannerSegment = TimelineSegmentBase & {
	type: "banner";
	bannerOptions: ShowBannerOptions;
	videoPath: string;
	durationMs: number;
	audio?: AudioLayer;
};

export type VideoOverlaySegment = TimelineSegmentBase & {
	type: "video-overlay";
	videoPath: string;
	durationMs: number;
	audio?: AudioLayer;
};

export type TimelineSegment =
	| ScreencastSegment
	| BannerSegment
	| VideoOverlaySegment;

export type TimelineManifest = {
	version: 1;
	createdAt: string;
	totalDurationMs: number;
	outputFile: string;
	size?: { width: number; height: number };
	segments: Array<TimelineSegment & { offsetMs: number }>;
};

export type TimelineOptions = {
	page: Page;
	outputDir: string;
	size?: { width: number; height: number };
};

// ============================================================================
// State
// ============================================================================

const cursorState = {
	lastPosition: { x: 0, y: 0 }
};

// ============================================================================
// Cursor Management
// ============================================================================

export async function addVisibleCursor(page: Page): Promise<void> {
	const cursorExists = await page.evaluate(() => {
		return document.getElementById("playwright-cursor") !== null;
	});

	if (cursorExists) return;

	const pos = cursorState.lastPosition;
	await page.evaluate((initialPos) => {
		const cursor = document.createElement("div");
		cursor.id = "playwright-cursor";
		cursor.style.cssText = `
			position: fixed;
			width: 32px;
			height: 32px;
			transform: translate(-1px, -1px);
			pointer-events: none;
			left: ${initialPos.x}px;
			top: ${initialPos.y}px;
			transition: transform 0.15s ease-out;
		`;

		cursor.innerHTML = `
			<svg id="cursor-arrow" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path d="M8.3,3.213l9.468,8.836c0.475,0.443,0.2,1.24-0.447,1.296L13.2,13.7l2.807,6.21c0.272,0.602,0.006,1.311-0.596,1.585l0,0 c-0.61,0.277-1.33,0-1.596-0.615L11.1,14.6l-2.833,2.695C7.789,17.749,7,17.411,7,16.751V3.778C7,3.102,7.806,2.752,8.3,3.213z" fill="white" stroke="#000000" stroke-width="0.5"/>
			</svg>
			<svg id="cursor-pointer" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display: none;">
				<path d="M 9.5 1 C 8.672 1 8 1.672 8 2.5 L 8 9 L 8 14 L 8 15.060547 L 5.3378906 13.710938 C 4.7798906 13.427938 4.1072344 13.492906 3.6152344 13.878906 C 2.8562344 14.474906 2.7887031 15.601203 3.4707031 16.283203 L 8.3085938 21.121094 C 8.8715937 21.684094 9.6346875 22 10.429688 22 L 17 22 C 18.657 22 20 20.657 20 19 L 20 12.193359 C 20 11.216359 19.292125 10.381703 18.328125 10.220703 L 11 9 L 11 2.5 C 11 1.672 10.328 1 9.5 1 z" fill="white" stroke="#000000" stroke-width="0.5"/>
			</svg>
			<svg id="cursor-text" width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display: none;">
				<path d="M 9 2 A 1.0001 1.0001 0 1 0 9 4 C 9.8333333 4 10.421991 4.2041597 10.802734 4.3945312 C 10.899195 4.4427618 10.93573 4.4711718 11 4.5097656 L 11 11 L 9 11 A 1.0001 1.0001 0 1 0 9 13 L 11 13 L 11 19.490234 C 10.93573 19.528828 10.899195 19.557238 10.802734 19.605469 C 10.421991 19.79584 9.8333333 20 9 20 A 1.0001 1.0001 0 1 0 9 22 C 10.166667 22 11.078009 21.70416 11.697266 21.394531 C 11.883184 21.301572 11.85968 21.280666 12 21.1875 C 12.14032 21.28067 12.116816 21.301572 12.302734 21.394531 C 12.921991 21.70416 13.833333 22 15 22 A 1.0001 1.0001 0 1 0 15 20 C 14.166667 20 13.578009 19.79584 13.197266 19.605469 C 13.100805 19.557238 13.06427 19.528828 13 19.490234 L 13 13 L 15 13 A 1.0001 1.0001 0 1 0 15 11 L 13 11 L 13 4.5097656 C 13.06427 4.4711718 13.100805 4.4427618 13.197266 4.3945312 C 13.578009 4.2041597 14.166667 4 15 4 A 1.0001 1.0001 0 1 0 15 2 C 13.833333 2 12.921991 2.2958402 12.302734 2.6054688 C 12.116816 2.6984278 12.14032 2.7193337 12 2.8125 C 11.85968 2.7193337 11.883184 2.6984278 11.697266 2.6054688 C 11.078009 2.2958402 10.166667 2 9 2 z" fill="white" stroke="#000000" stroke-width="0.5"/>
			</svg>
		`;

		document.body.appendChild(cursor);

		const style = document.createElement("style");
		style.id = "playwright-cursor-styles";
		style.textContent = `
			#playwright-cursor {
				z-index: 2147483647 !important;
				isolation: isolate;
			}
		`;
		document.head.appendChild(style);

		const arrow = cursor.querySelector("#cursor-arrow") as SVGElement;
		const pointer = cursor.querySelector("#cursor-pointer") as SVGElement;
		const text = cursor.querySelector("#cursor-text") as SVGElement;

		const updateCursor = (x: number, y: number) => {
			cursor.style.left = `${x}px`;
			cursor.style.top = `${y}px`;

			const elementUnder = document.elementFromPoint(x, y);

			const inputType =
				elementUnder instanceof HTMLInputElement
					? elementUnder.type.toLowerCase()
					: "";
			const isNonTextInput =
				inputType === "checkbox" ||
				inputType === "radio" ||
				inputType === "submit" ||
				inputType === "button" ||
				inputType === "reset";

			const isTextInput =
				elementUnder &&
				!isNonTextInput &&
				(elementUnder.tagName === "INPUT" ||
					elementUnder.tagName === "TEXTAREA" ||
					elementUnder.getAttribute("contenteditable") === "true" ||
					window.getComputedStyle(elementUnder).cursor === "text");

			const isClickable =
				elementUnder &&
				!isTextInput &&
				(isNonTextInput ||
					elementUnder.tagName === "BUTTON" ||
					elementUnder.tagName === "A" ||
					elementUnder.tagName === "SELECT" ||
					elementUnder.getAttribute("role") === "button" ||
					elementUnder.closest('button, a, [role="button"], [onclick]') !==
						null ||
					window.getComputedStyle(elementUnder).cursor === "pointer");

			if (isTextInput) {
				arrow.style.display = "none";
				pointer.style.display = "none";
				text.style.display = "block";
			} else if (isClickable) {
				arrow.style.display = "none";
				pointer.style.display = "block";
				text.style.display = "none";
			} else {
				arrow.style.display = "block";
				pointer.style.display = "none";
				text.style.display = "none";
			}

			const openDialogs = document.querySelectorAll("dialog[open]");
			if (openDialogs.length > 0) {
				const topmostDialog = openDialogs[openDialogs.length - 1];
				if (cursor.parentElement !== topmostDialog) {
					topmostDialog.appendChild(cursor);
					cursor.style.position = "fixed";
				}
			} else if (cursor.parentElement !== document.body) {
				document.body.appendChild(cursor);
			}
		};

		document.addEventListener(
			"mousemove",
			(e) => {
				updateCursor(e.clientX, e.clientY);
			},
			true
		);

		const observer = new MutationObserver(() => {
			const rect = cursor.getBoundingClientRect();
			updateCursor(rect.left, rect.top);
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["open"]
		});
	}, pos);
}

export async function hideCursor(page: Page): Promise<void> {
	await page.evaluate(() => {
		const cursor = document.getElementById("playwright-cursor");
		if (cursor) cursor.style.display = "none";
	});
}

export async function showCursor(page: Page): Promise<void> {
	const pos = cursorState.lastPosition;
	await page.evaluate(({ x, y }) => {
		const cursor = document.getElementById("playwright-cursor");
		if (cursor) {
			cursor.style.left = `${x}px`;
			cursor.style.top = `${y}px`;
			cursor.style.display = "block";
		}
	}, pos);
}

export async function updateCursorPosition(
	page: Page,
	x: number,
	y: number
): Promise<void> {
	await page.evaluate(
		(pos) => {
			const cursor = document.getElementById("playwright-cursor");
			if (cursor) {
				cursor.style.left = `${pos.x}px`;
				cursor.style.top = `${pos.y}px`;
			}
		},
		{ x, y }
	);
}

// ============================================================================
// Animations
// ============================================================================

let scrollOverlayDisposable: Disposable | null = null;

export async function showScrollAnimation(page: Page): Promise<void> {
	scrollOverlayDisposable = await page.screencast.showOverlay(`
		<div style="
			position: fixed;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			width: 80px;
			height: 100px;
			pointer-events: none;
			z-index: 2147483646;
			overflow: visible;
		">
			<svg width="80" height="100" viewBox="-10 -10 70 90" xmlns="http://www.w3.org/2000/svg">
				<rect x="10" y="5" width="30" height="50" rx="15" fill="none" stroke="white" stroke-width="3"
					style="filter: drop-shadow(0 0 8px rgba(0,0,0,0.6))"/>
				<circle cx="25" cy="20" r="5" fill="white" style="filter: drop-shadow(0 0 8px rgba(0,0,0,0.6))">
					<animate attributeName="cy" values="20;35;20" dur="1.5s" repeatCount="indefinite" begin="0s"/>
				</circle>
			</svg>
		</div>
	`);
}

export async function hideScrollAnimation(_page?: Page): Promise<void> {
	if (scrollOverlayDisposable) {
		await scrollOverlayDisposable.dispose();
		scrollOverlayDisposable = null;
	}
}

export async function showClickAnimation(
	page: Page,
	point: MousePoint
): Promise<void> {
	await page.evaluate((clickPoint) => {
		const ripple = document.createElement("div");
		ripple.style.cssText = `
			position: fixed;
			left: ${clickPoint.x}px;
			top: ${clickPoint.y}px;
			width: 40px;
			height: 40px;
			margin-left: -20px;
			margin-top: -20px;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.8);
			border: 3px solid rgba(255, 255, 255, 0.95);
			pointer-events: none;
			z-index: 2147483646;
			animation: clickPulse 0.6s ease-out;
			box-shadow: 0 0 12px 2px rgba(0, 0, 0, 0.6), 0 0 20px 4px rgba(0, 0, 0, 0.4);
		`;

		if (!document.getElementById("click-animation-styles")) {
			const style = document.createElement("style");
			style.id = "click-animation-styles";
			style.textContent = `
				@keyframes clickPulse {
					0% {
						transform: scale(0.8);
						opacity: 1;
					}
					50% {
						transform: scale(1.2);
						opacity: 0.8;
					}
					100% {
						transform: scale(1.5);
						opacity: 0;
					}
				}
			`;
			document.head.appendChild(style);
		}

		document.body.appendChild(ripple);
		setTimeout(() => ripple.remove(), 600);
	}, point);

	await page.waitForTimeout(300);
}

// ============================================================================
// Mouse Movement
// ============================================================================

async function getViewportSize(
	page: Page
): Promise<{ width: number; height: number }> {
	const viewport = page.viewportSize();
	if (viewport) return viewport;
	return page.evaluate(() => ({
		width: window.innerWidth,
		height: window.innerHeight
	}));
}

function isLocator(target: MouseTarget): target is Locator {
	return typeof (target as Locator).boundingBox === "function";
}

export async function smoothScrollToElement(
	page: Page,
	locator: Locator
): Promise<void> {
	const needsScroll = await locator.evaluate((el) => {
		const rect = el.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const isInViewport = rect.top >= 0 && rect.bottom <= viewportHeight;
		return !isInViewport;
	});

	if (!needsScroll) return;

	await hideCursor(page);
	await showScrollAnimation(page);
	await page.waitForTimeout(400);

	await locator.evaluate((el) => {
		el.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "center"
		});
	});

	await page.waitForTimeout(500);
	await hideScrollAnimation(page);
	await showCursor(page);
}

async function getLocatorCenter(locator: Locator): Promise<MousePoint> {
	const page = locator.page();
	await smoothScrollToElement(page, locator);
	await expect(locator).toBeVisible();

	const box = await locator.boundingBox();
	if (!box) {
		throw new Error(
			"Unable to compute locator center: boundingBox() returned null"
		);
	}

	return {
		x: box.x + box.width / 2,
		y: box.y + box.height / 2
	};
}

async function resolveMouseTarget(target: MouseTarget): Promise<MousePoint> {
	return isLocator(target) ? getLocatorCenter(target) : target;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function easeOutQuad(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

function mulberry32(seedValue: number): () => number {
	let t = seedValue >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

function bezierPoint(
	p0: MousePoint,
	p1: MousePoint,
	p2: MousePoint,
	p3: MousePoint,
	t: number
): MousePoint {
	const u = 1 - t;
	const tt = t * t;
	const uu = u * u;
	const uuu = uu * u;
	const ttt = tt * t;

	return {
		x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
		y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
	};
}

function createSeedFromPoints(start: MousePoint, end: MousePoint): number {
	const sx = Math.round(start.x);
	const sy = Math.round(start.y);
	const ex = Math.round(end.x);
	const ey = Math.round(end.y);
	let seed = 0x811c9dc5;
	seed = Math.imul(seed ^ sx, 0x01000193);
	seed = Math.imul(seed ^ sy, 0x01000193);
	seed = Math.imul(seed ^ ex, 0x01000193);
	seed = Math.imul(seed ^ ey, 0x01000193);
	return seed >>> 0;
}

export async function moveMouseInNiceCurve(
	page: Page,
	start: MousePoint,
	end: MousePoint,
	options?: MoveMouseInNiceCurveOptions
): Promise<void> {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const distance = Math.hypot(dx, dy);

	const durationMs =
		options?.durationMs ??
		clamp(Math.round((distance * 2.33 + 300) / 3), 200, 622);
	const steps = options?.steps ?? clamp(Math.round(durationMs / 18), 10, 50);
	const seed = options?.seed ?? createSeedFromPoints(start, end);
	const rand = mulberry32(seed);

	const inv = distance === 0 ? 0 : 1 / distance;
	const ux = dx * inv;
	const uy = dy * inv;
	const px = -uy;
	const py = ux;

	const baseCurvature = clamp(distance * (0.12 + rand() * 0.08), 18, 140);
	const curvature = baseCurvature * (rand() < 0.5 ? -1 : 1);

	const c1: MousePoint = {
		x: start.x + ux * distance * lerp(0.25, 0.4, rand()) + px * curvature,
		y: start.y + uy * distance * lerp(0.25, 0.4, rand()) + py * curvature
	};
	const c2: MousePoint = {
		x:
			start.x +
			ux * distance * lerp(0.6, 0.78, rand()) +
			px * (curvature * 0.65),
		y:
			start.y +
			uy * distance * lerp(0.6, 0.78, rand()) +
			py * (curvature * 0.65)
	};

	await page.mouse.move(Math.round(start.x), Math.round(start.y));
	await updateCursorPosition(page, Math.round(start.x), Math.round(start.y));

	const startedAt = Date.now();
	for (let i = 1; i <= steps; i++) {
		const tLinear = i / steps;
		const t = easeOutQuad(tLinear);
		const p = bezierPoint(start, c1, c2, end, t);

		const finalX = Math.round(p.x);
		const finalY = Math.round(p.y);

		await page.mouse.move(finalX, finalY);
		await updateCursorPosition(page, finalX, finalY);

		const targetAt = startedAt + (durationMs * i) / steps;
		const extra = (rand() - 0.5) * 8;
		const waitMs = Math.max(0, Math.round(targetAt - Date.now() + extra));
		if (waitMs > 0) await page.waitForTimeout(waitMs);
	}
}

export async function moveMouse(
	page: Page,
	options: MoveMouseOptions
): Promise<void> {
	await addVisibleCursor(page);
	const end = await resolveMouseTarget(options.to);

	let start: MousePoint;
	if (options.from) {
		start = await resolveMouseTarget(options.from);
	} else if (
		cursorState.lastPosition.x !== 0 ||
		cursorState.lastPosition.y !== 0
	) {
		start = cursorState.lastPosition;
	} else {
		const { width, height } = await getViewportSize(page);

		start = {
			x: width / 2,
			y: height / 2
		};

		await updateCursorPosition(page, start.x, start.y);
	}

	await moveMouseInNiceCurve(page, start, end, {
		durationMs: options.durationMs,
		steps: options.steps,
		seed: options.seed
	});

	cursorState.lastPosition = end;
}

// ============================================================================
// Typing Animation
// ============================================================================

export async function animatedType(
	page: Page,
	locator: Locator,
	text: string
): Promise<void> {
	await locator.scrollIntoViewIfNeeded();
	await moveMouse(page, { to: locator });

	const point = await getLocatorCenter(locator);
	await showClickAnimation(page, point);
	await hideCursor(page);

	const specialChars = new Set("!@#$%^&*(){}[]<>:;\"'`,./\\|?~-_=+\n\t");
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		// Pause before special characters, like humans hesitating before punctuation
		if (specialChars.has(char)) {
			await page.waitForTimeout(80 + Math.random() * 200);
		}
		await locator.pressSequentially(char, {
			delay: 20 + Math.random() * 60
		});
		// Occasional micro-pause mid-word to feel more human
		if (Math.random() < 0.1) {
			await page.waitForTimeout(40 + Math.random() * 120);
		}
	}

	await showCursor(page);
	await page.waitForTimeout(150);
}

// ============================================================================
// Highlight Animation
// ============================================================================

export async function highlightElement(
	page: Page,
	locator: Locator,
	options?: HighlightElementOptions
): Promise<void> {
	const duration = options?.duration ?? 2000;
	const borderColor = options?.borderColor ?? "#ff6b35";
	const borderWidth = options?.borderWidth ?? 4;
	const zoomScale = options?.zoomScale ?? 1.05;

	await locator.scrollIntoViewIfNeeded();

	const screenshotBuffer = await locator.screenshot();
	const screenshotBase64 = screenshotBuffer.toString("base64");

	const box = await locator.boundingBox();
	if (!box) return;

	const overlay = await page.screencast.showOverlay(`
		<div style="
			position: fixed;
			left: ${box.x}px;
			top: ${box.y}px;
			width: ${box.width}px;
			height: ${box.height}px;
			pointer-events: none;
			z-index: 2147483647;
			transform-origin: center center;
			transform: scale(${zoomScale});
		">
			<img src="data:image/png;base64,${screenshotBase64}" style="
				width: 100%;
				height: 100%;
				display: block;
				border-radius: inherit;
				outline: ${borderWidth}px solid ${borderColor};
				outline-offset: 2px;
				box-shadow: 0 0 20px 4px ${borderColor}80, 0 0 40px 8px ${borderColor}40;
			" />
		</div>
	`);

	await page.waitForTimeout(350 + duration);
	await overlay.dispose();
}

// ============================================================================
// Banner Animation
// ============================================================================

function createBannerScript(params: {
	title: string;
	backgroundColor: string;
	textColor: string;
	fontSize: string;
	initialOpacity: string;
	fadeInMs?: number;
	logoUrl?: string;
	logoText?: string;
}): string {
	const transition = params.fadeInMs
		? `transition: opacity ${params.fadeInMs}ms ease-out !important;`
		: "";

	let logoScript = "";
	if (params.logoUrl || params.logoText) {
		logoScript += `
		var logoContainer = document.createElement("div");
		logoContainer.style.cssText = "display: flex !important; align-items: center !important; justify-content: center !important; gap: 12px !important; margin: 0 0 24px 0 !important; padding: 0 !important; flex-shrink: 0 !important;";
		`;

		if (params.logoUrl) {
			logoScript += `
		var logoImg = document.createElement("img");
		logoImg.src = "${params.logoUrl}";
		logoImg.style.cssText = "height: 64px !important; width: auto !important; object-fit: contain !important; margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important;";
		logoContainer.appendChild(logoImg);
			`;
		}

		if (params.logoText) {
			logoScript += `
		var logoTextEl = document.createElement("div");
		logoTextEl.style.cssText = "font-size: 64px !important; font-weight: 700 !important; text-align: center !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important; letter-spacing: -0.3px !important; margin: 0 !important; padding: 0 !important; line-height: 1 !important; flex-shrink: 0 !important; opacity: 0.85 !important;";
		logoTextEl.textContent = "${params.logoText}";
		logoContainer.appendChild(logoTextEl);
			`;
		}

		logoScript += `
		banner.appendChild(logoContainer);
		`;
	}

	const fadeInScript = params.fadeInMs
		? `
		setTimeout(function() {
			banner.style.opacity = "1";
		}, 50);
		`
		: "";

	return `
		var oldBanner = document.getElementById("playwright-marketing-banner");
		if (oldBanner) oldBanner.remove();

		var banner = document.createElement("div");
		banner.id = "playwright-marketing-banner";
		banner.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; background: ${params.backgroundColor} !important; color: ${params.textColor} !important; z-index: 2147483647 !important; opacity: ${params.initialOpacity} !important; ${transition} display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 0 !important; box-sizing: border-box !important; border: none !important; outline: none !important; pointer-events: none !important;";

		${logoScript}

		var titleElement = document.createElement("div");
		titleElement.style.cssText = "font-size: ${params.fontSize} !important; font-weight: 600 !important; text-align: center !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important; letter-spacing: -0.5px !important; margin: 0 !important; padding: 0 !important; line-height: 1.2 !important; flex-shrink: 0 !important;";
		titleElement.textContent = "${params.title}";
		banner.appendChild(titleElement);

		document.body.appendChild(banner);

		${fadeInScript}
	`;
}

export async function showBanner(
	page: Page,
	options: ShowBannerOptions
): Promise<void> {
	const duration = options?.duration;
	const fadeInMs = options?.fadeInMs ?? 300;
	const fadeOutMs = options?.fadeOutMs ?? 300;
	const backgroundColor = options?.backgroundColor ?? "#1e212b";
	const textColor = options?.textColor ?? "#ffffff";
	const fontSize = options?.fontSize ?? "32px";

	if (options?.callback) {
		const bannerParams = {
			title: options.text,
			backgroundColor,
			textColor,
			fontSize,
			initialOpacity: "1",
			logoUrl: options.logoUrl,
			logoText: options.logoText
		};

		await page.evaluate(createBannerScript(bannerParams));

		// Save banner HTML to window.name so the addInitScript
		// can re-inject it instantly on any navigation during the callback
		await page.evaluate(() => {
			const banner = document.getElementById("playwright-marketing-banner");
			if (banner) {
				window.name = `__pmv:${banner.outerHTML}`;
			}
		});

		await options.callback();

		await page.waitForLoadState("domcontentloaded");
		await page.waitForLoadState("networkidle");

		// Clear persistence flag — banner is already in the current DOM
		await page.evaluate(() => {
			window.name = "";
		});
	} else {
		await page.evaluate(
			createBannerScript({
				title: options.text,
				backgroundColor,
				textColor,
				fontSize,
				initialOpacity: "0",
				fadeInMs,
				logoUrl: options.logoUrl,
				logoText: options.logoText
			})
		);

		await page.waitForTimeout(fadeInMs);
	}
	if (duration !== undefined) await page.waitForTimeout(duration);

	if (options?.fadeOut !== false) {
		await page.evaluate(
			({ fadeOutMs }) => {
				const banner = document.getElementById("playwright-marketing-banner");
				if (banner) {
					banner.style.transition = `opacity ${fadeOutMs}ms ease-in`;
					banner.style.opacity = "0";
				}
			},
			{ fadeOutMs }
		);

		await page.waitForTimeout(fadeOutMs);

		await page.evaluate(() => {
			const banner = document.getElementById("playwright-marketing-banner");
			if (banner) {
				banner.remove();
			}
		});
	}
}

// ============================================================================
// Voice-Over / Audio Layer
// ============================================================================

// biome-ignore lint/suspicious/noExplicitAny: cached KokoroTTS instance avoids importing the type
let kokoroInstance: any = null;

/**
 * Generates an audio file from text using text-to-speech.
 *
 * Supports two providers:
 * - `"kokoro"` (default) — free, local TTS via kokoro-js. No API key needed.
 * - `"elevenlabs"` — cloud TTS via ElevenLabs API. Requires ELEVENLABS_API_KEY.
 *
 * Caches the result locally to avoid regenerating the same audio.
 * The cache directory (`__audio_cache/`) is created in the current working
 * directory. Files are named by a SHA-256 hash of the configuration
 * so identical requests are served from disk.
 *
 * @param options - Text and voice configuration for generating audio
 * @returns AudioLayer with the file path to the generated/cached audio
 */
export async function generateAudioLayer(
	options: GenerateAudioLayerOptions
): Promise<AudioLayer> {
	const cacheDir =
		options.cacheDir ?? path.join(process.cwd(), "__audio_cache");
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	if (options.provider === "elevenlabs") {
		return generateElevenLabsAudio(options, cacheDir);
	}

	// Kokoro provider (default)
	const kokoroOpts = options as {
		provider?: "kokoro";
		text: string;
	} & KokoroOptions;
	const voice = kokoroOpts.voice ?? "af_heart";
	const dtype = kokoroOpts.dtype ?? "q8";
	const modelId = kokoroOpts.modelId ?? "onnx-community/Kokoro-82M-v1.0-ONNX";

	const hash = crypto
		.createHash("sha256")
		.update(`kokoro:${kokoroOpts.text}:${voice}:${dtype}:${modelId}`)
		.digest("hex")
		.substring(0, 16);

	const fileName = `${hash}.wav`;
	const filePath = path.join(cacheDir, fileName);

	if (fs.existsSync(filePath)) {
		console.log(`Using cached audio: ${fileName}`);
		return { filePath, text: kokoroOpts.text };
	}

	console.log(
		`Generating audio with Kokoro for: "${kokoroOpts.text.substring(0, 50)}..."`
	);

	try {
		const { KokoroTTS } = await import("kokoro-js");
		if (!kokoroInstance) {
			kokoroInstance = await KokoroTTS.from_pretrained(modelId, {
				dtype,
				device: "cpu"
			});
		}
		const result = await kokoroInstance.generate(kokoroOpts.text, {
			voice
		});
		result.save(filePath);

		console.log(`Audio generated and cached: ${fileName}`);
		return { filePath, text: kokoroOpts.text };
	} catch (error) {
		console.error("Error generating audio with Kokoro:", error);
		throw new Error(
			`Failed to generate audio with Kokoro. Make sure kokoro-js is installed (npm install kokoro-js): ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function generateElevenLabsAudio(
	options: {
		provider: "elevenlabs";
		text: string;
		voiceId: string;
		modelId?: string;
	},
	cacheDir: string
): Promise<AudioLayer> {
	const { text, voiceId, modelId = "eleven_multilingual_v2" } = options;

	const hash = crypto
		.createHash("sha256")
		.update(`elevenlabs:${text}:${voiceId}:${modelId}`)
		.digest("hex")
		.substring(0, 16);

	const fileName = `${hash}.mp3`;
	const filePath = path.join(cacheDir, fileName);

	if (fs.existsSync(filePath)) {
		console.log(`Using cached audio: ${fileName}`);
		return { filePath, text, voiceId };
	}

	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw new Error(
			"ELEVENLABS_API_KEY environment variable is not set. Please set it to use text-to-speech functionality."
		);
	}

	console.log(`Generating audio for: "${text.substring(0, 50)}..."`);

	const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
	const elevenlabs = new ElevenLabsClient({
		apiKey
	});

	try {
		const audio = await elevenlabs.textToSpeech.convert(voiceId, {
			text,
			modelId: modelId
		});

		const chunks: Buffer[] = [];
		const reader = audio.getReader();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(Buffer.from(value));
		}

		const buffer = Buffer.concat(chunks);
		fs.writeFileSync(filePath, buffer);

		console.log(`Audio generated and cached: ${fileName}`);

		return { filePath, text, voiceId };
	} catch (error) {
		console.error("Error generating audio:", error);
		throw new Error(
			`Failed to generate audio from ElevenLabs API: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ============================================================================
// Video Overlay — Provider: Runway
// ============================================================================

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";
const RUNWAY_POLL_INTERVAL_MS = 5000;
const RUNWAY_TIMEOUT_MS = 600_000;

async function runwayFetch(
	apiKey: string,
	endpoint: string,
	options: RequestInit = {}
): Promise<Response> {
	const response = await fetch(`${RUNWAY_API_BASE}${endpoint}`, {
		...options,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"X-Runway-Version": RUNWAY_API_VERSION,
			"Content-Type": "application/json",
			...options.headers
		}
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Runway API error ${response.status}: ${response.statusText}${body ? ` — ${body}` : ""}`
		);
	}

	return response;
}

async function runwayPollUntilDone(
	apiKey: string,
	taskId: string
): Promise<string[]> {
	const deadline = Date.now() + RUNWAY_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const response = await runwayFetch(apiKey, `/tasks/${taskId}`);
		const task = (await response.json()) as {
			status: string;
			output?: string[];
			failure?: string;
		};

		if (task.status === "SUCCEEDED") {
			if (!task.output || task.output.length === 0) {
				throw new Error("Runway task succeeded but returned no output URLs");
			}
			return task.output;
		}

		if (task.status === "FAILED") {
			throw new Error(
				`Runway task failed: ${task.failure ?? "unknown reason"}`
			);
		}

		if (task.status === "CANCELED") {
			throw new Error("Runway task was canceled");
		}

		await new Promise((r) => setTimeout(r, RUNWAY_POLL_INTERVAL_MS));
	}

	throw new Error(
		`Runway task ${taskId} timed out after ${RUNWAY_TIMEOUT_MS / 1000}s`
	);
}

/**
 * Runway video provider using the Gen-4 Turbo text-to-video API.
 * Accepts an API key directly or falls back to the RUNWAYML_API_KEY environment variable.
 */
export class RunwayVideoProvider implements VideoProvider {
	readonly name = "runway";
	private readonly model: string;
	private readonly apiKey?: string;

	constructor(options?: { model?: string; apiKey?: string }) {
		this.model = options?.model ?? "gen4_turbo";
		this.apiKey = options?.apiKey;
	}

	async generate(options: {
		prompt: string;
		durationSec: number;
		aspectRatio: string;
		cacheDir?: string;
		cacheKey?: string;
	}): Promise<Buffer> {
		const apiKey = this.apiKey ?? process.env.RUNWAYML_API_KEY;
		if (!apiKey) {
			throw new Error(
				"No Runway API key provided. Pass it to the RunwayVideoProvider constructor or set the RUNWAYML_API_KEY environment variable."
			);
		}

		const ratio = options.aspectRatio === "9:16" ? "720:1280" : "1280:720";

		// Check for a pending task from a previous (timed-out) run
		const taskFile =
			options.cacheDir && options.cacheKey
				? path.join(options.cacheDir, `${options.cacheKey}.runway-task`)
				: null;

		let taskId: string | null = null;

		if (taskFile && fs.existsSync(taskFile)) {
			taskId = fs.readFileSync(taskFile, "utf-8").trim();
			console.log(`[runway] Resuming previous task: ${taskId}`);

			// Verify the task is still active before resuming
			try {
				const response = await runwayFetch(apiKey, `/tasks/${taskId}`);
				const task = (await response.json()) as {
					status: string;
					failure?: string;
				};
				if (task.status === "FAILED" || task.status === "CANCELED") {
					console.log(
						`[runway] Previous task ${task.status.toLowerCase()}, starting a new one`
					);
					taskId = null;
					fs.unlinkSync(taskFile);
				}
			} catch {
				console.log(
					"[runway] Could not check previous task status, starting a new one"
				);
				taskId = null;
				fs.unlinkSync(taskFile);
			}
		}

		if (!taskId) {
			console.log(
				`[runway] Creating text-to-video task: "${options.prompt.substring(0, 60)}..." (${options.durationSec}s, ${ratio})`
			);

			const createResponse = await runwayFetch(apiKey, "/text_to_video", {
				method: "POST",
				body: JSON.stringify({
					model: this.model,
					promptText: options.prompt,
					ratio,
					duration: options.durationSec
				})
			});

			const result = (await createResponse.json()) as { id: string };
			taskId = result.id;

			// Persist the task ID so a subsequent run can resume polling
			if (taskFile) {
				fs.writeFileSync(taskFile, taskId, "utf-8");
			}
		}

		console.log(`[runway] Task ${taskId}, polling for completion...`);

		const outputUrls = await runwayPollUntilDone(apiKey, taskId);

		// Clean up the task file once we have a result
		if (taskFile && fs.existsSync(taskFile)) {
			fs.unlinkSync(taskFile);
		}

		const videoUrl = outputUrls[0];
		console.log(`[runway] Task completed, downloading video...`);

		const videoResponse = await fetch(videoUrl);
		if (!videoResponse.ok) {
			throw new Error(
				`Failed to download Runway video: ${videoResponse.status}`
			);
		}

		return Buffer.from(await videoResponse.arrayBuffer());
	}
}

// ============================================================================
// Video Overlay — Provider: URL
// ============================================================================

/**
 * Video provider that downloads a video file from a URL.
 * Useful for using pre-existing video files hosted anywhere (CDN, S3, etc.)
 * without AI generation. The downloaded file is cached locally.
 */
export class UrlVideoProvider implements VideoProvider {
	readonly name = "url";
	private readonly url: string;

	constructor(url: string) {
		this.url = url;
	}

	async generate(): Promise<Buffer> {
		console.log(`[url] Downloading video from: ${this.url}`);

		const response = await fetch(this.url);
		if (!response.ok) {
			throw new Error(
				`Failed to download video from ${this.url}: ${response.status} ${response.statusText}`
			);
		}

		return Buffer.from(await response.arrayBuffer());
	}
}

// ============================================================================
// Video Overlay — Generate & Play
// ============================================================================

const defaultVideoProvider = new RunwayVideoProvider();

/**
 * Generates a short AI video clip from a text prompt.
 * Caches the result locally to avoid regenerating the same video.
 *
 * The cache directory (`__video_cache/`) is created in the current working
 * directory. Files are named by a SHA-256 hash of the prompt + duration +
 * aspect ratio so identical requests are served from disk.
 *
 * @param options - Prompt, duration, and provider configuration
 * @returns VideoOverlay with the file path to the generated/cached MP4
 */
export async function generateVideoOverlay(
	options: GenerateVideoOverlayOptions
): Promise<VideoOverlay> {
	const {
		prompt,
		durationSec = 5,
		aspectRatio = "16:9",
		provider = defaultVideoProvider
	} = options;

	const cacheDir =
		options.cacheDir ?? path.join(process.cwd(), "__video_cache");

	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	const hash = crypto
		.createHash("sha256")
		.update(prompt + durationSec + aspectRatio + provider.name)
		.digest("hex")
		.substring(0, 16);

	const fileName = `${hash}.mp4`;
	const filePath = path.join(cacheDir, fileName);

	if (fs.existsSync(filePath)) {
		console.log(`Using cached video: ${fileName}`);
		return { filePath, prompt, durationSec };
	}

	console.log(
		`Generating video overlay (${provider.name}): "${prompt.substring(0, 50)}..."`
	);

	try {
		const buffer = await provider.generate({
			prompt,
			durationSec,
			aspectRatio,
			cacheDir,
			cacheKey: hash
		});

		fs.writeFileSync(filePath, buffer);
		console.log(`Video generated and cached: ${fileName}`);

		return { filePath, prompt, durationSec };
	} catch (error) {
		throw new Error(
			`Failed to generate video overlay via ${provider.name}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Plays a video overlay as a full-screen layer on the Playwright page.
 * The video is injected as a base64-encoded `<video>` element that covers the
 * entire viewport — Playwright's native video recording captures it as part
 * of the page, so no external editing is needed.
 *
 * @param page - Playwright page instance
 * @param overlay - VideoOverlay object from generateVideoOverlay
 * @param waitForVideoToFinish - Whether to wait for the video to finish before returning (default: true)
 */
export async function playVideoOverlay(
	page: Page,
	videoOverlay: VideoOverlay,
	waitForVideoToFinish: boolean = true
): Promise<void> {
	const videoBuffer = fs.readFileSync(videoOverlay.filePath);
	const videoBase64 = videoBuffer.toString("base64");

	await hideCursor(page);

	const overlay = await page.screencast.showOverlay(`
		<video
			style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: 2147483647; pointer-events: none; margin: 0; padding: 0; border: none;"
			src="data:video/mp4;base64,${videoBase64}"
			muted
			autoplay
			playsinline
		></video>
	`);

	if (waitForVideoToFinish) {
		const durationMs = videoOverlay.durationSec * 1000;
		if (durationMs > 0) {
			await page.waitForTimeout(durationMs);
			await overlay.dispose();
		}
	}

	await showCursor(page);
}

// ============================================================================
// Screencast Helpers
// ============================================================================

export type ShowChapterOptions = {
	description?: string;
	duration?: number;
};

/**
 * Shows a chapter overlay with a title and optional description, centered on the
 * page with a blurred backdrop — ideal for section titles in marketing videos.
 * The overlay is automatically removed after the specified duration (default 2000ms).
 *
 * Uses Playwright v1.59's `page.screencast.showChapter()` API.
 */
export async function showChapter(
	page: Page,
	title: string,
	options?: ShowChapterOptions
): Promise<void> {
	await page.screencast.showChapter(title, {
		description: options?.description,
		duration: options?.duration ?? 2000
	});
}

/**
 * Enables visual action annotations on the screencast. Each Playwright action
 * (click, fill, etc.) will be annotated on the video recording with a label.
 * Returns a Disposable that can be used to stop showing actions.
 *
 * Uses Playwright v1.59's `page.screencast.showActions()` API.
 */
export async function showActionAnnotations(
	page: Page,
	options?: {
		duration?: number;
		fontSize?: number;
		position?:
			| "top-left"
			| "top"
			| "top-right"
			| "bottom-left"
			| "bottom"
			| "bottom-right";
	}
): Promise<Disposable> {
	return page.screencast.showActions(options);
}

export type ScreencastOptions = {
	path?: string;
	size?: { width: number; height: number };
	quality?: number;
};

/**
 * Starts high-resolution screencast recording using Playwright v1.59's
 * screencast API. This replaces the older `video` config approach and
 * gives direct control over resolution and quality.
 *
 * Call `stopScreencast(page)` or dispose the returned Disposable to stop recording.
 *
 * @example
 * ```ts
 * const recording = await startScreencast(page, {
 *   path: 'marketing-video.webm',
 *   size: { width: 1920, height: 1080 },
 * });
 * // ... perform actions ...
 * await recording.dispose(); // or await stopScreencast(page);
 * ```
 */
export async function startScreencast(
	page: Page,
	options?: ScreencastOptions
): Promise<Disposable> {
	return page.screencast.start({
		path: options?.path,
		size: options?.size ?? { width: 1920, height: 1080 },
		quality: options?.quality
	});
}

/**
 * Stops the screencast recording on the given page.
 */
export async function stopScreencast(page: Page): Promise<void> {
	await page.screencast.stop();
}

// ============================================================================
// Timeline
// ============================================================================

/**
 * Records a Playwright screencast as discrete segments that can be composed
 * with audio in post-production.  Each call to `cut()` or `playAudio()` ends
 * the current segment and starts a new one.  After the test, call `compose()`
 * to stitch all segments + audio into a single mp4 using ffmpeg.
 *
 * Segments are generic — screencast captures, banners, and video overlays
 * are all supported and can carry per-segment properties like fadeIn/fadeOut.
 */
export class Timeline {
	private page: Page;
	private outputDir: string;
	private size?: { width: number; height: number };

	private segments: TimelineSegment[] = [];
	private segmentCounter = 0;
	private currentRecording: Disposable | null = null;
	private currentSegmentStart = 0;
	private currentFrameDir = "";
	private currentFrameCount = 0;
	private currentFrameTimestamps: number[] = [];
	private frameTickInterval: ReturnType<typeof setInterval> | null = null;
	private lastFrameData: Buffer | null = null;
	private started = false;

	constructor(options: TimelineOptions) {
		this.page = options.page;
		this.outputDir = path.resolve(options.outputDir);
		this.size = options.size;
	}

	/** Start recording the first screencast segment. */
	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;

		// Default to the page's viewport size for the screencast recording.
		// Without this, the screencast may record at a much lower resolution.
		if (!this.size) {
			const viewport = this.page.viewportSize();
			if (viewport) {
				this.size = { width: viewport.width, height: viewport.height };
			}
		}

		if (!fs.existsSync(this.outputDir)) {
			fs.mkdirSync(this.outputDir, { recursive: true });
		}

		await this.startNewSegment();
	}

	/**
	 * Cut the current screencast segment and start a new one.
	 * Options (fadeInMs, fadeOutMs, audio) are applied to the NEW segment.
	 */
	async cut(options?: {
		audio?: AudioLayer;
		fadeInMs?: number;
		fadeOutMs?: number;
	}): Promise<TimelineSegment> {
		const finalized = await this.finalizeCurrentSegment();
		await this.startNewSegment({
			audio: options?.audio,
			fadeInMs: options?.fadeInMs,
			fadeOutMs: options?.fadeOutMs
		});
		return finalized;
	}

	/**
	 * Create a cut point with audio attached to the next segment.
	 *
	 * Accepts either a pre-generated `AudioLayer` or `GenerateAudioLayerOptions`
	 * to generate audio on the fly.
	 *
	 * When `wait` is true, waits for the audio duration before returning.
	 * The page stays live during the wait (recording whatever is on screen).
	 */
	async playAudio(
		audioOrOptions: AudioLayer | GenerateAudioLayerOptions,
		segmentOptions?: {
			fadeInMs?: number;
			fadeOutMs?: number;
			/** Wait for the audio duration before continuing. */
			wait?: boolean;
		}
	): Promise<AudioLayer> {
		const audio =
			"filePath" in audioOrOptions
				? audioOrOptions
				: await generateAudioLayer(audioOrOptions);
		await this.cut({
			audio,
			fadeInMs: segmentOptions?.fadeInMs,
			fadeOutMs: segmentOptions?.fadeOutMs
		});

		// Play audio in the browser for debugging in headed mode.
		// In headless mode this is a no-op (no audio device).
		await this.playAudioInBrowser(audio);

		if (segmentOptions?.wait) {
			const durationMs = await this.probeDuration(audio.filePath);
			await this.page.waitForTimeout(durationMs);
		}

		return audio;
	}

	/**
	 * Insert a non-screencast segment (e.g. banner or video overlay).
	 * Stops the current screencast, records the segment via screencast,
	 * then starts a new screencast segment afterwards.
	 */
	async addSegment(
		segment:
			| Omit<BannerSegment, "id" | "videoPath">
			| Omit<VideoOverlaySegment, "id" | "videoPath">
	): Promise<TimelineSegment> {
		await this.finalizeCurrentSegment();

		const segId = this.nextSegmentId();
		const videoPath = path.join(this.outputDir, `${segId}.webm`);

		// Record the banner/overlay as a screencast segment
		this.currentRecording = await this.page.screencast.start({
			path: videoPath,
			size: this.size,
			quality: 100
		});
		this.currentSegmentStart = Date.now();

		if (segment.type === "banner") {
			await showBanner(this.page, segment.bannerOptions);
		}

		await this.page.waitForTimeout(segment.durationMs);
		await this.page.screencast.stop();
		this.currentRecording = null;

		const full: TimelineSegment = {
			...segment,
			id: segId,
			videoPath,
			durationMs: segment.durationMs
		} as TimelineSegment;

		this.segments.push(full);

		// Resume screencast recording
		await this.startNewSegment();

		return full;
	}

	/** Stop recording and finalize the last segment. */
	async stop(): Promise<void> {
		if (!this.started) return;
		await this.finalizeCurrentSegment();
		this.started = false;
	}

	/** Get all segments in order. */
	getSegments(): readonly TimelineSegment[] {
		return this.segments;
	}

	/** Write the timeline manifest to disk. */
	async writeManifest(outputFile: string): Promise<TimelineManifest> {
		const segmentsWithOffset: Array<TimelineSegment & { offsetMs: number }> =
			[];
		let offset = 0;
		for (const seg of this.segments) {
			const duration = seg.durationMs ?? 0;
			segmentsWithOffset.push({ ...seg, offsetMs: offset });
			offset += duration;
		}

		const manifest: TimelineManifest = {
			version: 1,
			createdAt: new Date().toISOString(),
			totalDurationMs: offset,
			outputFile,
			size: this.size,
			segments: segmentsWithOffset
		};

		const manifestPath = path.join(this.outputDir, "timeline.json");
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		return manifest;
	}

	/**
	 * Compose all segments + audio into a final mp4 using ffmpeg.
	 * Requires ffmpeg and ffprobe on PATH.
	 */
	async compose(outputPath: string): Promise<string> {
		outputPath = path.resolve(outputPath);

		if (this.segments.length === 0) {
			throw new Error("Timeline has no segments to compose");
		}

		await this.assertFfmpegAvailable();

		const segCount = this.segments.length;
		const audioCount = this.segments.filter((s) => s.audio?.filePath).length;
		console.log(
			`[Timeline] Composing ${segCount} segments (${audioCount} with audio)…`
		);

		// 1. Probe each segment for exact duration
		for (const seg of this.segments) {
			if (seg.durationMs == null && seg.videoPath) {
				seg.durationMs = await this.probeDuration(seg.videoPath);
			}
		}

		// 2. Write manifest
		await this.writeManifest(outputPath);

		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// 3. Concat all segments into a single video, transcoding once to h264
		const concatListPath = path.join(this.outputDir, "concat_list.txt");
		const concatContent = this.segments
			.map((s) => `file '${path.resolve(s.videoPath)}'`)
			.join("\n");
		fs.writeFileSync(concatListPath, concatContent);

		console.log("[Timeline] Concatenating segments…");
		const concatPath = path.join(this.outputDir, "concat_raw.mp4");
		await execFileAsync("ffmpeg", [
			"-y",
			"-f",
			"concat",
			"-safe",
			"0",
			"-i",
			concatListPath,
			// Segments are already h264 mp4 — stream copy, no re-encoding
			"-c",
			"copy",
			concatPath
		]);

		// 6. Overlay audio tracks at computed offsets
		const audioSegments = this.segments.filter((s) => s.audio?.filePath);
		if (audioSegments.length > 0) {
			console.log(`[Timeline] Mixing ${audioSegments.length} audio tracks…`);
			const totalDurationMs = this.segments.reduce(
				(sum, s) => sum + (s.durationMs ?? 0),
				0
			);
			const totalDurationSec = totalDurationMs / 1000;

			const audioInputs: string[] = [];
			const delayFilters: string[] = [];
			const audioLabels: string[] = [];

			let audioIdx = 0;
			for (const seg of audioSegments) {
				const offsetMs = this.getSegmentOffset(seg);
				// audio input index is audioIdx + 1 (0 is the video)
				audioInputs.push("-i", seg.audio?.filePath as string);
				const label = `a${audioIdx}`;
				delayFilters.push(
					`[${audioIdx + 1}:a]adelay=${offsetMs}|${offsetMs}[${label}]`
				);
				audioLabels.push(`[${label}]`);
				audioIdx++;
			}

			// amix normalizes volume by dividing by input count — use volume filter to compensate
			const volumeBoost = audioIdx + 1;
			const mixFilter = `anullsrc=r=44100:cl=stereo:d=${totalDurationSec}[base];${delayFilters.join(";")}; [base]${audioLabels.join("")}amix=inputs=${volumeBoost}:duration=first,volume=${volumeBoost}[aout]`;

			await execFileAsync("ffmpeg", [
				"-y",
				"-i",
				concatPath,
				...audioInputs,
				"-filter_complex",
				mixFilter,
				"-map",
				"0:v",
				"-map",
				"[aout]",
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-shortest",
				outputPath
			]);
		} else {
			// No audio — just copy
			fs.renameSync(concatPath, outputPath);
		}

		// 7. Clean up temp files
		if (fs.existsSync(concatPath)) fs.unlinkSync(concatPath);
		fs.unlinkSync(concatListPath);

		console.log(`[Timeline] Video ready: ${outputPath}`);

		return outputPath;
	}

	// ---- Private helpers ----

	private nextSegmentId(): string {
		const id = `seg_${String(this.segmentCounter).padStart(3, "0")}`;
		this.segmentCounter++;
		return id;
	}

	private async startNewSegment(options?: {
		audio?: AudioLayer;
		fadeInMs?: number;
		fadeOutMs?: number;
	}): Promise<void> {
		const segId = this.nextSegmentId();
		const frameDir = path.join(this.outputDir, segId);
		fs.mkdirSync(frameDir, { recursive: true });

		this.currentFrameDir = frameDir;
		this.currentFrameCount = 0;
		this.currentFrameTimestamps = [];
		this.lastFrameData = null;

		const segmentStartTime = Date.now();
		this.currentSegmentStart = segmentStartTime;

		const writeFrame = (data: Buffer) => {
			const framePath = path.join(
				frameDir,
				`frame_${String(this.currentFrameCount).padStart(6, "0")}.jpg`
			);
			fs.writeFileSync(framePath, data);
			this.currentFrameTimestamps.push(Date.now() - segmentStartTime);
			this.currentFrameCount++;
		};

		// Capture high-quality JPEG frames via onFrame callback
		// instead of relying on VP8's low-bitrate WebM recording.
		this.currentRecording = await this.page.screencast.start({
			size: this.size,
			quality: 100,
			onFrame: ({ data }) => {
				this.lastFrameData = data;
				writeFrame(data);
			}
		});

		// Fill gaps at ~30fps by repeating the last frame when content
		// hasn't changed — ensures smooth cursor movement in the video.
		this.frameTickInterval = setInterval(() => {
			if (this.lastFrameData) {
				writeFrame(this.lastFrameData);
			}
		}, 1000 / 30);

		// videoPath will be set after finalizing (assembled from frames)
		const videoPath = path.join(this.outputDir, `${segId}.mp4`);
		const segment: ScreencastSegment = {
			id: segId,
			type: "screencast",
			videoPath,
			audio: options?.audio,
			fadeInMs: options?.fadeInMs,
			fadeOutMs: options?.fadeOutMs
		};
		this.segments.push(segment);
	}

	private async finalizeCurrentSegment(): Promise<TimelineSegment> {
		if (this.frameTickInterval) {
			clearInterval(this.frameTickInterval);
			this.frameTickInterval = null;
		}

		const elapsed = Date.now() - this.currentSegmentStart;
		const current = this.segments[this.segments.length - 1];

		if (this.currentRecording) {
			await this.page.screencast.stop();
			this.currentRecording = null;
		}

		if (current && current.durationMs == null) {
			current.durationMs = elapsed;
		}

		// Assemble frames into a high-quality mp4 segment using
		// per-frame durations (frames arrive at irregular intervals).
		if (this.currentFrameCount > 0 && current?.videoPath) {
			const timestamps = this.currentFrameTimestamps;

			// Build concat demuxer input with per-frame durations
			const lines: string[] = [];
			for (let i = 0; i < this.currentFrameCount; i++) {
				const framePath = path.join(
					this.currentFrameDir,
					`frame_${String(i).padStart(6, "0")}.jpg`
				);
				const durationSec =
					i < timestamps.length - 1
						? (timestamps[i + 1] - timestamps[i]) / 1000
						: i > 0
							? (elapsed - timestamps[i]) / 1000
							: (elapsed || 1) / 1000;
				lines.push(`file '${path.resolve(framePath)}'`);
				lines.push(`duration ${Math.max(durationSec, 0.001)}`);
			}
			// Concat demuxer needs the last file repeated without duration
			if (this.currentFrameCount > 0) {
				const lastFrame = path.join(
					this.currentFrameDir,
					`frame_${String(this.currentFrameCount - 1).padStart(6, "0")}.jpg`
				);
				lines.push(`file '${path.resolve(lastFrame)}'`);
			}

			const frameListPath = path.join(this.currentFrameDir, "frames.txt");
			fs.writeFileSync(frameListPath, lines.join("\n"));

			await execFileAsync("ffmpeg", [
				"-y",
				"-f",
				"concat",
				"-safe",
				"0",
				"-i",
				frameListPath,
				"-c:v",
				"libx264",
				"-crf",
				"1",
				"-pix_fmt",
				"yuv420p",
				"-an",
				current.videoPath
			]);

			// Clean up frame files
			const frameFiles = fs.readdirSync(this.currentFrameDir);
			for (const f of frameFiles) {
				fs.unlinkSync(path.join(this.currentFrameDir, f));
			}
			fs.rmdirSync(this.currentFrameDir);
		}

		return current;
	}

	private async playAudioInBrowser(audio: AudioLayer): Promise<void> {
		try {
			const audioBuffer = fs.readFileSync(audio.filePath);
			const audioBase64 = audioBuffer.toString("base64");
			const ext = path.extname(audio.filePath).slice(1);
			const mimeType = ext === "wav" ? "audio/wav" : "audio/mpeg";

			await this.page.evaluate(
				({ src, mimeType }) => {
					const el = document.createElement("audio");
					el.src = `data:${mimeType};base64,${src}`;
					el.autoplay = true;
					document.body.appendChild(el);
					el.addEventListener("ended", () => el.remove(), { once: true });
				},
				{ src: audioBase64, mimeType }
			);
		} catch {
			// Ignore — audio preview is best-effort
		}
	}

	private getSegmentOffset(segment: TimelineSegment): number {
		let offset = 0;
		for (const seg of this.segments) {
			if (seg.id === segment.id) return offset;
			offset += seg.durationMs ?? 0;
		}
		return offset;
	}

	private async probeDuration(filePath: string): Promise<number> {
		const { stdout } = await execFileAsync("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			filePath
		]);
		return Math.round(Number.parseFloat(stdout.trim()) * 1000);
	}

	private async assertFfmpegAvailable(): Promise<void> {
		try {
			await execFileAsync("ffmpeg", ["-version"]);
			await execFileAsync("ffprobe", ["-version"]);
		} catch {
			throw new Error(
				"ffmpeg and ffprobe are required for timeline composition. Install them: https://ffmpeg.org/download.html"
			);
		}
	}
}

// ============================================================================
// Playwright Fixture
// ============================================================================

function wrapLocatorWithMarketingActions(
	page: Page,
	locator: Locator
): Locator {
	const originalClick = locator.click.bind(locator);

	locator.click = async (options?: Parameters<Locator["click"]>[0]) => {
		await addVisibleCursor(page);
		const point = await getLocatorCenter(locator);
		await moveMouse(page, { to: locator });
		await showClickAnimation(page, point);
		await originalClick.call(locator, options);
	};

	locator.fill = async (
		value: string,
		_options?: Parameters<Locator["fill"]>[1]
	) => {
		await addVisibleCursor(page);
		await animatedType(page, locator, value);
	};

	const originalSelectOption = locator.selectOption.bind(locator);
	locator.selectOption = async (
		...args: Parameters<Locator["selectOption"]>
	) => {
		await addVisibleCursor(page);
		await moveMouse(page, { to: locator });
		const point = await getLocatorCenter(locator);
		await showClickAnimation(page, point);
		return originalSelectOption(...args);
	};

	return locator;
}

/**
 * Extended Playwright test fixture that automatically adds marketing
 * animations to all page interactions (clicks, typing, mouse movements).
 *
 * Use this instead of `@playwright/test`'s `test` to get animated
 * cursor, click ripples, and typing effects out of the box.
 *
 * Banners persist across navigations via addInitScript + sessionStorage.
 *
 * Optionally destructure `timeline` to enable segment-based recording
 * with post-production audio composition.
 *
 * Recording does NOT start automatically — call `timeline.start()` when
 * you're ready. This lets you set up test data (create users, seed a
 * project, etc.) without recording that setup:
 *
 * ```ts
 * test("demo", async ({ page, timeline }) => {
 *   // Setup — not recorded
 *   await page.goto("https://app.example.com/setup");
 *   await createDemoUser(page);
 *
 *   // Start recording
 *   await timeline.start();
 *   await timeline.playAudio({ text: "Welcome" });
 *   await page.goto("https://app.example.com");
 * });
 * // → marketing-videos/demo.mp4 is composed automatically
 * ```
 */
export const test = base.extend<{ page: Page; timeline: Timeline }>({
	timeline: [
		async ({ page }, use, testInfo) => {
			const segmentsDir = testInfo.outputPath("timeline-segments");

			const timeline = new Timeline({
				page,
				outputDir: segmentsDir
			});

			await use(timeline);

			// Only compose if recording was started
			if (timeline.getSegments().length > 0) {
				await timeline.stop();

				const slug = testInfo.title
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");
				const outputPath = testInfo.outputPath(`${slug}.mp4`);

				await timeline.compose(outputPath);

				await testInfo.attach("marketing-video", {
					path: outputPath,
					contentType: "video/mp4"
				});
			}
		},
		{ auto: false }
	],

	page: async ({ page }, use) => {
		// Re-inject banner on every navigation from window.name
		await page.addInitScript(() => {
			try {
				if (window.name?.startsWith("__pmv:")) {
					const bannerHtml = window.name.substring(6);
					const inject = () => {
						if (!document.getElementById("playwright-marketing-banner")) {
							document.body.insertAdjacentHTML("beforeend", bannerHtml);
						}
					};
					if (document.body) {
						inject();
					} else {
						document.addEventListener("DOMContentLoaded", inject, {
							once: true
						});
					}
				}
			} catch (_) {
				// ignore
			}
		});

		await addVisibleCursor(page);

		const originalLocator = page.locator.bind(page);
		const originalGetByTestId = page.getByTestId.bind(page);
		const originalGetByRole = page.getByRole.bind(page);
		const originalGetByText = page.getByText.bind(page);
		const originalGetByLabel = page.getByLabel.bind(page);
		const originalGetByPlaceholder = page.getByPlaceholder.bind(page);
		const originalGetByAltText = page.getByAltText.bind(page);
		const originalGetByTitle = page.getByTitle.bind(page);

		page.locator = ((
			selector: Parameters<Page["locator"]>[0],
			options?: Parameters<Page["locator"]>[1]
		) => {
			const locator = originalLocator(selector, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["locator"];

		page.getByTestId = ((testId: string) => {
			const locator = originalGetByTestId(testId);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByTestId"];

		page.getByRole = ((
			role: Parameters<Page["getByRole"]>[0],
			options?: Parameters<Page["getByRole"]>[1]
		) => {
			const locator = originalGetByRole(role, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByRole"];

		page.getByText = ((
			text: Parameters<Page["getByText"]>[0],
			options?: Parameters<Page["getByText"]>[1]
		) => {
			const locator = originalGetByText(text, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByText"];

		page.getByLabel = ((
			label: Parameters<Page["getByLabel"]>[0],
			options?: Parameters<Page["getByLabel"]>[1]
		) => {
			const locator = originalGetByLabel(label, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByLabel"];

		page.getByPlaceholder = ((
			placeholder: Parameters<Page["getByPlaceholder"]>[0],
			options?: Parameters<Page["getByPlaceholder"]>[1]
		) => {
			const locator = originalGetByPlaceholder(placeholder, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByPlaceholder"];

		page.getByAltText = ((
			altText: Parameters<Page["getByAltText"]>[0],
			options?: Parameters<Page["getByAltText"]>[1]
		) => {
			const locator = originalGetByAltText(altText, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByAltText"];

		page.getByTitle = ((
			title: Parameters<Page["getByTitle"]>[0],
			options?: Parameters<Page["getByTitle"]>[1]
		) => {
			const locator = originalGetByTitle(title, options);
			return wrapLocatorWithMarketingActions(page, locator);
		}) as Page["getByTitle"];

		await use(page);
	}
});

export { expect };
