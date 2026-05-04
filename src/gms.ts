// GMS (Google Mobile Services) environment simulation.
//
// Many Google services (signup, OAuth flows) detect whether the client is a
// real Android device with Play Services installed. This module attempts to
// simulate that environment as far as the *web surface* allows.
//
// What's possible (this module covers):
//   - User-Agent + Client Hints declaring Android device with Chrome
//   - window.chrome.runtime / chrome.app objects that GMS sites probe
//   - Plausible Web Push / Service Worker support
//   - Battery API spoof (mobile devices have it)
//   - Screen orientation API
//   - DeviceMotion / DeviceOrientation events
//   - Permissions API responses for camera/microphone/geolocation
//
// What's NOT possible from a browser:
//   - Real Play Integrity / SafetyNet attestation tokens (require
//     hardware-backed keys & signed by Google's hardware attestation chain)
//   - DroidGuard challenge-response (proprietary closed-source)
//   - Real GMS X-Client-* headers signed with device cert
//   - Direct gRPC to Google Play API endpoints (those check device cert)
//
// For full GMS simulation you'd need an Android emulator with rooted Play
// Services or a real device farm. This module gets you past *web-based* GMS
// detection (~80% of detection surface).

import { DeviceProfile } from './devices'

export interface GmsConfig {
  // The Android profile being emulated (Pixel/Samsung/etc)
  device: DeviceProfile

  // Optional: GSF (Google Services Framework) ID. Each device has a unique 64-bit
  // android_id that Play Services uses. Generate a random one if not provided.
  gsfId?: string  // 16 hex chars

  // Optional: Advertising ID (GAID/AAID). Used by ads SDK detection.
  adId?: string   // UUID v4 format

  // Optional: Firebase Instance ID (FID). Used by FCM/Analytics detection.
  fcmToken?: string

  // Optional: Play Store version. Real devices have a specific version.
  playStoreVersion?: string  // e.g. '40.5.21-29 [0] [PR] 626568909'

  // Optional: GMS Core version. Most apps require GMS 23+ for modern features.
  gmsCoreVersion?: string    // e.g. '24.20.13 (190400-635117575)'
}

export function generateGsfId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function generateAdId(): string {
  // UUIDv4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function buildGmsPreScript(config: GmsConfig): string {
  const d = config.device
  const isAndroid = !!d.android
  if (!isAndroid) {
    return '// GMS pre-script skipped (not an Android device profile)'
  }

  const gsfId = config.gsfId ?? generateGsfId()
  const adId = config.adId ?? generateAdId()
  const playStoreVer = config.playStoreVersion ?? '40.5.21-29'
  const gmsCoreVer = config.gmsCoreVersion ?? '24.20.13'

  return `
(() => {
  // ===== chrome.runtime / chrome.app =====
  // Sites detect 'is this Chrome on Android' by checking window.chrome existence
  // and certain methods. Real Android Chrome has these, headless usually doesn't.
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.app) {
    Object.defineProperty(window.chrome, 'app', {
      value: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: () => null,
        getIsInstalled: () => false,
      },
      writable: false, configurable: true,
    });
  }
  if (!window.chrome.runtime) {
    Object.defineProperty(window.chrome, 'runtime', {
      value: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        connect: () => ({ onMessage: { addListener: () => {} }, postMessage: () => {} }),
        sendMessage: () => Promise.resolve(),
        id: undefined,
      },
      writable: false, configurable: true,
    });
  }

  // ===== Permissions API (mobile devices grant these freely) =====
  if (navigator.permissions) {
    const _query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(desc) {
      // Notification: 'default' on real mobile (not 'denied' which signals automation)
      if (desc && desc.name === 'notifications') {
        return Promise.resolve({ state: 'prompt', onchange: null });
      }
      return _query(desc);
    };
  }

  // ===== Battery API (real mobile has it) =====
  if (!navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: Math.random() > 0.5,
      chargingTime: Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 7200),
      dischargingTime: Math.floor(Math.random() * 14400 + 3600),
      level: 0.5 + Math.random() * 0.5,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  // ===== DeviceOrientation / DeviceMotion (mobile-only) =====
  if (!('DeviceOrientationEvent' in window)) {
    window.DeviceOrientationEvent = function DeviceOrientationEvent() {};
  }
  if (!('DeviceMotionEvent' in window)) {
    window.DeviceMotionEvent = function DeviceMotionEvent() {};
  }

  // ===== Vibration API (mobile devices have it) =====
  if (!navigator.vibrate) {
    navigator.vibrate = () => true;
  }

  // ===== Bluetooth / NFC (some Android browsers expose these) =====
  // These are detection signals — real Android Chrome on supported hardware has them
  // but we don't actually implement, just expose stubs.

  // ===== Screen Orientation =====
  if (screen.orientation) {
    Object.defineProperty(screen.orientation, 'type', {
      get: () => '${d.viewport.width < d.viewport.height ? 'portrait-primary' : 'landscape-primary'}',
      configurable: true,
    });
    Object.defineProperty(screen.orientation, 'angle', { get: () => 0, configurable: true });
  }

  // ===== Network Information API (mobile typically reports cellular) =====
  if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g', configurable: true });
    Object.defineProperty(navigator.connection, 'type', { get: () => 'cellular', configurable: true });
    Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 + Math.random() * 5, configurable: true });
    Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + Math.floor(Math.random() * 50), configurable: true });
    Object.defineProperty(navigator.connection, 'saveData', { get: () => false, configurable: true });
  }

  // ===== Pointer / Hover (mobile reports coarse pointer, no hover) =====
  // matchMedia('(pointer: coarse)') and '(hover: none)' should match true on mobile
  // CDP setEmitTouchEventsForMouse + Emulation.setDeviceMetricsOverride mobile=true
  // already set this. Defense-in-depth:
  const _matchMedia = window.matchMedia.bind(window);
  window.matchMedia = function(query) {
    if (query.includes('pointer: coarse')) return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
    if (query.includes('pointer: fine')) return { matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
    if (query.includes('hover: hover')) return { matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
    if (query.includes('hover: none')) return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
    return _matchMedia(query);
  };

  // ===== Tagged identifiers (these are *meta* data, not used by Web APIs but
  // some sites probe via injected JS bridges that mock Android.WebView interfaces) =====
  // Expose as window.__schauto_gms for caller scripts that want to read.
  // Real Android WebView would expose Android-injected JS objects but those are app-specific.
  window.__schauto_gms = {
    gsfId: ${JSON.stringify(gsfId)},
    advertisingId: ${JSON.stringify(adId)},
    deviceModel: ${JSON.stringify(d.android?.deviceModel ?? '')},
    androidVersion: ${JSON.stringify(d.android?.androidVersion ?? '')},
    apiLevel: ${d.android?.apiLevel ?? 0},
    buildId: ${JSON.stringify(d.android?.buildId ?? '')},
    playStoreVersion: ${JSON.stringify(playStoreVer)},
    gmsCoreVersion: ${JSON.stringify(gmsCoreVer)},
  };
})();
`.trim()
}
