import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	test as base,
	expect,
	type Locator,
	type Page
} from "@playwright/test";

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
	| ({ provider?: "kokoro"; text: string } & KokoroOptions)
	| {
			provider: "elevenlabs";
			text: string;
			voiceId: string;
			modelId?: string;
	  };

export type ShowBannerOptions = {
	duration?: number;
	fadeInMs?: number;
	fadeOutMs?: number;
	backgroundColor?: string;
	textColor?: string;
	fontSize?: string;
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

	await page.evaluate(() => {
		const cursor = document.createElement("div");
		cursor.id = "playwright-cursor";
		cursor.style.cssText = `
			position: fixed;
			width: 32px;
			height: 32px;
			transform: translate(-1px, -1px);
			pointer-events: none;
			left: 0;
			top: 0;
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

			const isTextInput =
				elementUnder &&
				(elementUnder.tagName === "INPUT" ||
					elementUnder.tagName === "TEXTAREA" ||
					elementUnder.getAttribute("contenteditable") === "true" ||
					window.getComputedStyle(elementUnder).cursor === "text");

			const isClickable =
				elementUnder &&
				!isTextInput &&
				(elementUnder.tagName === "BUTTON" ||
					elementUnder.tagName === "A" ||
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
	});
}

export async function hideCursor(page: Page): Promise<void> {
	await page.evaluate(() => {
		const cursor = document.getElementById("playwright-cursor");
		if (cursor) cursor.style.display = "none";
	});
}

export async function showCursor(page: Page): Promise<void> {
	await page.evaluate(() => {
		const cursor = document.getElementById("playwright-cursor");
		if (cursor) cursor.style.display = "block";
	});
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

export async function showScrollAnimation(page: Page): Promise<void> {
	const pos = cursorState.lastPosition;

	await page.evaluate((position) => {
		const scrollIndicator = document.createElement("div");
		scrollIndicator.id = "scroll-indicator";

		const left = position ? `${position.x + 40}px` : "auto";
		const right = position ? "auto" : "30px";
		const top = position ? `${position.y}px` : "50%";
		const transform = position ? "translateY(-50%)" : "translateY(-50%)";

		scrollIndicator.style.cssText = `
			position: fixed;
			left: ${left};
			right: ${right};
			top: ${top};
			transform: ${transform};
			width: 80px;
			height: 100px;
			pointer-events: none;
			z-index: 2147483646;
			overflow: visible;
		`;

		scrollIndicator.innerHTML = `
			<svg width="80" height="100" viewBox="-10 -10 70 90" xmlns="http://www.w3.org/2000/svg">
				<rect x="10" y="5" width="30" height="50" rx="15" fill="none" stroke="white" stroke-width="3"
					style="filter: drop-shadow(0 0 8px rgba(0,0,0,0.6))"/>
				<circle cx="25" cy="20" r="5" fill="white" style="filter: drop-shadow(0 0 8px rgba(0,0,0,0.6))">
					<animate attributeName="cy" values="20;35;20" dur="1.5s" repeatCount="indefinite" begin="0s"/>
				</circle>
			</svg>
		`;

		document.body.appendChild(scrollIndicator);
		void scrollIndicator.offsetHeight;
	}, pos);
}

export async function hideScrollAnimation(page: Page): Promise<void> {
	await page.evaluate(() => {
		document.getElementById("scroll-indicator")?.remove();
	});
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

async function smoothScrollToElement(
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
	await expect(locator).toBeInViewport({ timeout: 5000 });

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
		options?.durationMs ?? clamp(Math.round(distance * 2.33 + 300), 600, 1867);
	const steps = options?.steps ?? clamp(Math.round(durationMs / 18), 30, 140);
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

	for (let i = 0; i < text.length; i++) {
		await locator.pressSequentially(text[i], {
			delay: 50 + Math.random() * 100
		});
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

	await page.evaluate(
		({ box, borderColor, borderWidth, zoomScale, screenshot }) => {
			const overlay = document.createElement("div");
			overlay.id = "playwright-highlight-overlay";
			overlay.style.cssText = `
				position: fixed;
				left: ${box.x}px;
				top: ${box.y}px;
				width: ${box.width}px;
				height: ${box.height}px;
				pointer-events: none;
				z-index: 2147483647;
				transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
				transform-origin: center center;
				transform: scale(1);
			`;

			const img = document.createElement("img");
			img.src = `data:image/png;base64,${screenshot}`;
			img.style.cssText = `
				width: 100%;
				height: 100%;
				display: block;
				border-radius: inherit;
				outline: ${borderWidth}px solid ${borderColor};
				outline-offset: 2px;
				box-shadow: 0 0 20px 4px ${borderColor}80, 0 0 40px 8px ${borderColor}40;
			`;

			overlay.appendChild(img);
			document.body.appendChild(overlay);

			setTimeout(() => {
				overlay.style.transform = `scale(${zoomScale})`;
			}, 50);
		},
		{
			box,
			borderColor,
			borderWidth,
			zoomScale,
			screenshot: screenshotBase64
		}
	);

	await page.waitForTimeout(350 + duration);

	await page.evaluate(() => {
		const overlay = document.getElementById("playwright-highlight-overlay");
		if (overlay) {
			overlay.style.transition = "all 0.3s ease-out";
			overlay.style.transform = "scale(1)";
			overlay.style.opacity = "0";
		}
	});

	await page.waitForTimeout(300);

	await page.evaluate(() => {
		const overlay = document.getElementById("playwright-highlight-overlay");
		if (overlay) {
			overlay.remove();
		}
	});
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
}): string {
	return `
		// Remove old banner if it exists
		const oldBanner = document.getElementById("playwright-marketing-banner");
		if (oldBanner) oldBanner.remove();

		const banner = document.createElement("div");
		banner.id = "playwright-marketing-banner";
		banner.style.cssText = \`
			position: fixed !important;
			top: 0 !important;
			left: 0 !important;
			right: 0 !important;
			bottom: 0 !important;
			width: 100vw !important;
			height: 100vh !important;
			margin: 0 !important;
			padding: 0 !important;
			background: ${params.backgroundColor} !important;
			color: ${params.textColor} !important;
			z-index: 2147483647 !important;
			opacity: ${params.initialOpacity} !important;
			${params.fadeInMs ? `transition: opacity ${params.fadeInMs}ms ease-out !important;` : ""}
			display: flex !important;
			flex-direction: column !important;
			align-items: center !important;
			justify-content: center !important;
			gap: 0 !important;
			box-sizing: border-box !important;
			border: none !important;
			outline: none !important;
			pointer-events: none !important;
		\`;

		// Add title
		const titleElement = document.createElement("div");
		titleElement.style.cssText = \`
			font-size: ${params.fontSize} !important;
			font-weight: 600 !important;
			text-align: center !important;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
			text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
			letter-spacing: -0.5px !important;
			margin: 0 !important;
			padding: 0 !important;
			line-height: 1.2 !important;
			flex-shrink: 0 !important;
		\`;
		titleElement.textContent = "${params.title}";
		banner.appendChild(titleElement);

		document.body.appendChild(banner);

		${
			params.fadeInMs
				? `
		// Trigger fade-in
		setTimeout(() => {
			banner.style.opacity = "1";
		}, 50);
		`
				: ""
		}
	`;
}

export async function showBanner(
	page: Page,
	title: string,
	options?: ShowBannerOptions
): Promise<void> {
	const duration = options?.duration ?? 2000;
	const fadeInMs = options?.fadeInMs ?? 300;
	const fadeOutMs = options?.fadeOutMs ?? 300;
	const backgroundColor = options?.backgroundColor ?? "#1e212b";
	const textColor = options?.textColor ?? "#ffffff";
	const fontSize = options?.fontSize ?? "48px";

	if (options?.callback) {
		const bannerParams = {
			title,
			backgroundColor,
			textColor,
			fontSize,
			initialOpacity: "1"
		};

		await page.evaluate(createBannerScript(bannerParams));

		const loadListener = async () => {
			await page.evaluate(createBannerScript(bannerParams));
		};
		page.on("load", loadListener);

		await options.callback();

		page.off("load", loadListener);

		await page.waitForLoadState("domcontentloaded");
		await page.waitForLoadState("networkidle");

		await page.waitForTimeout(duration);
	} else {
		await page.evaluate(
			createBannerScript({
				title,
				backgroundColor,
				textColor,
				fontSize,
				initialOpacity: "0",
				fadeInMs
			})
		);

		await page.waitForTimeout(fadeInMs);
		await page.waitForTimeout(duration);
	}

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
	const cacheDir = path.join(process.cwd(), "__audio_cache");
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

/**
 * Injects and plays an audio file in the Playwright page.
 *
 * @param page - Playwright page instance
 * @param audioLayer - AudioLayer object containing the file path to the audio
 * @param waitForAudioToFinish - Whether to wait for the audio to finish playing before returning
 */
export async function playAudio(
	page: Page,
	audioLayer: AudioLayer,
	waitForAudioToFinish: boolean = false
): Promise<void> {
	const audioBuffer = fs.readFileSync(audioLayer.filePath);
	const audioBase64 = audioBuffer.toString("base64");
	const ext = path.extname(audioLayer.filePath).slice(1);
	const mimeType = ext === "wav" ? "audio/wav" : "audio/mpeg";

	await page.evaluate(
		({ audio, mimeType }) => {
			const oldAudio = document.getElementById("playwright-marketing-audio");
			if (oldAudio) oldAudio.remove();

			const audioElement = document.createElement("audio");
			audioElement.id = "playwright-marketing-audio";
			audioElement.style.cssText = `
				position: fixed;
				bottom: 20px;
				right: 20px;
				z-index: 2147483647;
				opacity: 0;
				pointer-events: none;
			`;

			audioElement.src = `data:${mimeType};base64,${audio}`;
			audioElement.autoplay = false;

			document.body.appendChild(audioElement);
		},
		{ audio: audioBase64, mimeType }
	);

	const duration = await page.evaluate(() => {
		const audioElement = document.getElementById(
			"playwright-marketing-audio"
		) as HTMLAudioElement;
		return new Promise<number>((resolve) => {
			if (audioElement.duration && !Number.isNaN(audioElement.duration)) {
				resolve(audioElement.duration * 1000);
			} else {
				audioElement.addEventListener("loadedmetadata", () => {
					resolve(audioElement.duration * 1000);
				});
			}
		});
	});

	await page.waitForTimeout(100);
	await page.evaluate(async () => {
		await (
			document.getElementById("playwright-marketing-audio") as HTMLAudioElement
		).play();
	});

	if (
		waitForAudioToFinish === true &&
		!Number.isNaN(duration) &&
		duration > 0
	) {
		await page.waitForTimeout(duration);

		await page.evaluate(() => {
			const audioElement = document.getElementById(
				"playwright-marketing-audio"
			);
			if (audioElement) {
				audioElement.remove();
			}
		});
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

	return locator;
}

/**
 * Extended Playwright test fixture that automatically adds marketing
 * animations to all page interactions (clicks, typing, mouse movements).
 *
 * Use this instead of `@playwright/test`'s `test` to get animated
 * cursor, click ripples, and typing effects out of the box.
 */
export const test = base.extend<{ page: Page }>({
	page: async ({ page }, use) => {
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
