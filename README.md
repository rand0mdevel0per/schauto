# schauto

Stealth Chromium automation framework with kernel-level fingerprint randomization. Built by patching Chromium source directly — no JS-level overrides that can be detected by `Object.getOwnPropertyDescriptor`.

## Features

- **Fingerprint randomization at C++ level** via `FingerprintToolkit` (per-context xorshift64 seed)
  - Canvas / WebGL image data noise
  - AudioContext buffer perturbation
  - ClientRects coordinate jitter
  - WebGL vendor / renderer spoofing
  - Navigator hardwareConcurrency, platform
  - SpeechSynthesis voices filtering
  - Timezone spoofing
  - Font allowlist filtering
  - WebRTC IP leak prevention (proxy-bound)
- **No-window mode** (kernel-level, not just `--headless` flag)
- **Auto geo-match from proxy IP** (timezone, language, platform via ip-api.com → ipwho.is → ipapi.co fallback chain)
- **Built-in AdBlock Plus** MV3 extension (auto-loaded)
- **SOCKS5 / HTTP proxy** support
- **Bezier mouse curves** with jitter for captcha solving
- **Image API**: full-page screenshot, region screenshot, element screenshot, boundingBox

## Installation

```bash
npm install schauto
```

The package ships with the patched Chromium binary (~400MB). First install will take a while.

## Usage

```typescript
import { Browser } from 'schauto'

// Auto: detect timezone/language from proxy IP
const browser = await Browser.launch({
  proxy: 'socks5://user:pass@proxy.example.com:1080',
})

// Mobile device profile + GMS spoofing for Google services
const phone = await Browser.launch({
  proxy: 'http://127.0.0.1:7890',
  device: 'Pixel 7',           // or 'iPhone 14 Pro' / 'Samsung Galaxy S23' / 'iPad Pro' / 'Desktop Win' / etc.
  gms: true,                   // inject chrome.runtime, getBattery, vibrate, GSF/Ad ID
  timezone: 'Asia/Tokyo',
  language: 'ja-JP',
})

// Custom DeviceProfile
import { DeviceProfile } from 'schauto'
const customDevice: DeviceProfile = {
  name: 'My Test Device',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; CustomPhone) AppleWebKit/537.36...',
  platform: 'Linux armv8l',
  mobile: true,
  brand: 'Google Chrome', brandVersion: '148', fullVersion: '148.0.7654.123',
  screen: { width: 360, height: 800, dpr: 3 },
  viewport: { width: 360, height: 800 },
  touchPoints: 5, hasTouch: true,
  hardwareConcurrency: 8, deviceMemory: 8,
  webglVendor: 'Google Inc. (ARM)',
  webglRenderer: 'ANGLE (ARM, Mali-G77 MC9, OpenGL ES 3.2)',
  webglUnmaskedVendor: 'ARM',
  webglUnmaskedRenderer: 'Mali-G77 MC9',
  android: { deviceModel: 'CustomPhone', androidVersion: '14', apiLevel: 34, chromeMajor: 148 },
}
const customBrowser = await Browser.launch({ device: customDevice })

const ctx = await browser.newContext()
const page = await ctx.newPage()

await page.goto('https://bot.sannysoft.com/')

const png = await page.image.screenshot()
require('fs').writeFileSync('result.png', png)

// Mouse with Bezier curve + jitter (anti-captcha)
await page.mouse.move(100, 100, { x: 500, y: 400 })
await page.mouse.click(500, 400)

// Element screenshot
const cropped = await page.image.screenshotElement('#captcha-image')

await browser.close()
```

## Device profiles

Built-in presets (use by name):

| Name | Platform | UA family | Touch | Notes |
|------|----------|-----------|-------|-------|
| `Desktop Win` | Win32 | Chrome 148 / Win10 | No | NVIDIA GTX 1660 |
| `Desktop Mac` | MacIntel | Chrome 148 / macOS | No | Apple M2 |
| `Desktop Linux` | Linux x86_64 | Chrome 148 / Linux | No | Mesa Intel UHD 620 |
| `Pixel 7` | Linux armv8l | Chrome 148 / Android 14 | Yes (5pts) | ARM Mali-G710, GMS-ready |
| `Pixel 8 Pro` | Linux armv8l | Chrome 148 / Android 14 | Yes (5pts) | ARM Immortalis-G715, GMS-ready |
| `Samsung Galaxy S23` | Linux armv8l | Chrome 148 / Android 14 | Yes (10pts) | Adreno 740 |
| `iPhone 14 Pro` | iPhone | Safari 17.5 / iOS 17 | Yes (5pts) | Apple A16 GPU |
| `iPad Pro` | iPad | Safari 17.5 / iPadOS 17 | Yes (10pts) | Apple M2 GPU |

Or define your own via `DeviceProfile` interface.

## GMS (Google Mobile Services) simulation

Pass `gms: true` along with an Android device profile to enable:

- `window.chrome.runtime` / `chrome.app` (Google sign-in probes these)
- `navigator.getBattery()`, `navigator.vibrate()`
- `window.DeviceOrientationEvent`, `window.DeviceMotionEvent`
- `navigator.connection` returns `{ type: 'cellular', effectiveType: '4g' }`
- `screen.orientation` returns `'portrait-primary'`
- `matchMedia('(pointer: coarse)')` matches, `(hover: hover)` doesn't
- Generated GSF ID, Advertising ID, Build ID exposed via `window.__schauto_gms`

```typescript
const b = await Browser.launch({
  device: 'Pixel 7',
  gms: {
    gsfId: 'abc123def456...',           // optional, generated if omitted
    adId: 'aaaaaaaa-...',                // optional UUID v4
    playStoreVersion: '40.5.21-29',
    gmsCoreVersion: '24.20.13',
  }
})
```

**Limitations** (require real Android hardware, not bypassable from a browser):
- ❌ Play Integrity API hardware-backed attestation
- ❌ SafetyNet attestation tokens
- ❌ DroidGuard challenge-response (closed-source)
- ❌ Real GMS gRPC endpoints with device cert signing

What this gets you: ~80% of *web-based* Google service detection, including Google account signup flow, OAuth web flows, and most Google sign-in surfaces.

## Fingerprint protection layers

schauto applies fingerprint protection at three layers:

| Layer | Mechanism | Status |
|-------|-----------|--------|
| **CDP emulation** (no recompile) | `Emulation.setTimezoneOverride`, `setLocaleOverride`, `setGeolocationOverride`, `setUserAgentOverride` | ✅ Active |
| **CLI flags** (no recompile) | `--disable-blink-features=AutomationControlled`, `--exclude-switches=enable-automation`, `--lang`, `--accept-lang` | ✅ Active |
| **Kernel patches** (recompile required) | `FingerprintToolkit` C++ class for Canvas/WebGL/Audio/ClientRects/Font noise | 🚧 Scaffolding present, real injection in progress |

The CDP+CLI layers already give you:
- ✅ `navigator.webdriver = false`
- ✅ `Intl.DateTimeFormat().resolvedOptions().timeZone` returns spoofed value
- ✅ `navigator.language` / `navigator.languages` match proxy geo
- ✅ `navigator.userAgent` platform-matched
- ✅ Native TLS JA4 fingerprint of real Chrome (not detectable as automation)
- ✅ Geolocation API returns spoofed lat/lon

The kernel-patch layer is what adds the harder-to-fake noise (Canvas pixel jitter, WebGL vendor spoof, AudioContext perturbation). These need a custom Chromium build via the GitHub Actions workflow.

## Architecture

```
schauto/
├── src/                    TS source (Browser, BrowserContext, Page, Mouse, ImageHelper, CDP client)
├── chromium-patches/       FingerprintToolkit C++ source (copied into Chromium tree at build time)
├── patches/                Unified diffs applied to Chromium source
│   ├── 00-local-frame-toolkit.patch    LocalFrame member injection
│   ├── 00b-frame-init-toolkit.patch    LocalFrame::Init() reads CLI flags
│   ├── 01-no-window.patch              No-window mode
│   ├── 02-canvas-noise.patch           Canvas data noise
│   ├── 03-webgl-spoof.patch            WebGL VENDOR/RENDERER override
│   ├── 04-audio-noise.patch            AudioContext buffer noise
│   ├── 05-client-rects.patch           ClientRects coordinate jitter
│   ├── 06-navigator.patch              Navigator API spoofing
│   ├── 07-webrtc-ip.patch              WebRTC IP leak prevention
│   ├── 08-timezone.patch               Timezone spoofing
│   ├── 09-speech-voices.patch          SpeechSynthesis voices
│   └── 10-font-filter.patch            Font allowlist
├── build/                  Build scripts
│   ├── fetch-chromium.sh   Fetches Chromium source via gclient
│   ├── apply-patches.py    Applies patches programmatically
│   ├── apply-patches.sh    Wrapper
│   └── args.gn             Chromium build args (Release, no-symbols, no-component, etc.)
├── extensions/
│   └── adblock-plus/       MV3 extension auto-loaded into every context
└── dist/                   Compiled JS (output of `npm run build`)
```

## Building from source

Requires:
- Windows 10/11 with Visual Studio 2019+ Build Tools
- `depot_tools` from Chromium project
- ~150GB disk space, 16GB+ RAM, several hours

```bash
# 1. Fetch Chromium (slow, ~80GB)
./build/fetch-chromium.sh

# 2. Apply patches
python build/apply-patches.py

# 3. Configure GN
cd chromium-src/src
cp ../../build/args.gn out/Release/args.gn
gn gen out/Release

# 4. Compile (4-8 hours)
ninja -C out/Release chrome

# 5. Build npm package
cd ../..
npm run build
```

## API

### `Browser.launch(opts: LaunchOptions): Promise<Browser>`

```typescript
interface LaunchOptions {
  proxy?: string              // 'socks5://...' or 'http://...'
  executablePath?: string     // Override chrome.exe path
  // Hard overrides (skip geo-resolver if any of these are provided)
  timezone?: string           // 'Asia/Tokyo', 'America/New_York', etc.
  language?: string           // 'ja-JP', 'en-US', etc.
  platform?: string           // 'Win32' | 'MacIntel' | 'Linux x86_64'
  latitude?: number
  longitude?: number
  countryCode?: string
}
```

### `BrowserContext`
- `newPage(): Promise<Page>`
- `close(): Promise<void>`

### `Page`
- `goto(url: string): Promise<void>`
- `evaluate<T>(fn: string | Function, ...args): Promise<T>`
- `$(selector): Promise<string | null>`
- `screenshot(): Promise<Buffer>`
- `close(): Promise<void>`
- `mouse: Mouse` — Bezier-curve mouse helper
- `image: ImageHelper` — screenshot helpers

### `ImageHelper`
- `screenshot(): Promise<Buffer>`
- `screenshotRegion(x, y, w, h): Promise<Buffer>`
- `screenshotElement(selector): Promise<Buffer | null>`
- `boundingBox(selector): Promise<{x, y, width, height} | null>`

### `Mouse`
- `move(from: {x,y}, to: {x,y}): Promise<void>` — Bezier curve with jitter
- `click(x, y): Promise<void>`

## License

MIT
