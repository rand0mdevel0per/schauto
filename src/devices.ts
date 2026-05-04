// Device profile presets for schauto.
// Each profile defines what a "real" device of that type would expose to the browser.
// Profiles are applied via CDP Emulation.* methods + CLI flags + (when patches active) FingerprintToolkit.

export interface DeviceProfile {
  name: string

  // ===== Browser identity =====
  userAgent: string
  acceptLanguage?: string  // overridden per-launch by geo

  // ===== Platform =====
  platform: 'Win32' | 'MacIntel' | 'Linux x86_64' | 'Linux armv8l' | 'iPhone' | 'iPad' | 'Linux aarch64'
  mobile: boolean           // navigator.userAgentData.mobile
  brand: 'Chromium' | 'Google Chrome' | 'Microsoft Edge' | 'Brave'
  brandVersion: string      // e.g. '148'
  fullVersion: string       // e.g. '148.0.7654.123'

  // ===== Screen / viewport =====
  screen: { width: number; height: number; dpr: number }
  viewport: { width: number; height: number }

  // ===== Touch =====
  touchPoints: number       // 0 = no touch, 5 = phone, 10 = tablet
  hasTouch: boolean

  // ===== Hardware =====
  hardwareConcurrency: number
  deviceMemory?: number     // GB. Mobile: 4/6/8. Desktop: 8/16/32

  // ===== GPU (read by WebGL) =====
  webglVendor: string                 // GL_VENDOR
  webglRenderer: string               // GL_RENDERER
  webglUnmaskedVendor: string         // UNMASKED_VENDOR_WEBGL (debug ext)
  webglUnmaskedRenderer: string       // UNMASKED_RENDERER_WEBGL (debug ext)

  // ===== Android-specific (for GMS detection bypass) =====
  android?: {
    deviceModel: string       // 'Pixel 7', 'SM-S911U'
    androidVersion: string    // '14'
    apiLevel: number          // 34
    chromeMajor: number       // 148
    buildId?: string          // 'UQ1A.240205.004'
  }
}

// =============================================================
// Presets — based on real device user-agent strings (Chrome 148)
// =============================================================

export const DESKTOP_WIN_CHROME: DeviceProfile = {
  name: 'Desktop Chrome / Win10',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  platform: 'Win32',
  mobile: false,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 1920, height: 1080, dpr: 1 },
  viewport: { width: 1280, height: 720 },
  touchPoints: 0,
  hasTouch: false,
  hardwareConcurrency: 12,
  deviceMemory: 16,
  webglVendor: 'Google Inc. (NVIDIA)',
  webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0)',
  webglUnmaskedVendor: 'Google Inc. (NVIDIA)',
  webglUnmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0)',
}

export const DESKTOP_MAC_CHROME: DeviceProfile = {
  name: 'Desktop Chrome / macOS',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  platform: 'MacIntel',
  mobile: false,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 1728, height: 1117, dpr: 2 },
  viewport: { width: 1280, height: 720 },
  touchPoints: 0,
  hasTouch: false,
  hardwareConcurrency: 10,
  deviceMemory: 16,
  webglVendor: 'Google Inc. (Apple)',
  webglRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
  webglUnmaskedVendor: 'Google Inc. (Apple)',
  webglUnmaskedRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
}

export const DESKTOP_LINUX_CHROME: DeviceProfile = {
  name: 'Desktop Chrome / Linux',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  platform: 'Linux x86_64',
  mobile: false,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 1920, height: 1080, dpr: 1 },
  viewport: { width: 1280, height: 720 },
  touchPoints: 0,
  hasTouch: false,
  hardwareConcurrency: 8,
  deviceMemory: 16,
  webglVendor: 'Google Inc. (Mesa)',
  webglRenderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
  webglUnmaskedVendor: 'Intel',
  webglUnmaskedRenderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
}

export const PIXEL_7: DeviceProfile = {
  name: 'Pixel 7',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  mobile: true,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 412, height: 915, dpr: 2.625 },
  viewport: { width: 412, height: 915 },
  touchPoints: 5,
  hasTouch: true,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  webglVendor: 'Google Inc. (Google)',
  webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (ARM Mali-G710 MC10 (0xA0790000)), ARM driver-r43p0-01eac0)',
  webglUnmaskedVendor: 'ARM',
  webglUnmaskedRenderer: 'Mali-G710 MC10',
  android: {
    deviceModel: 'Pixel 7',
    androidVersion: '14',
    apiLevel: 34,
    chromeMajor: 148,
    buildId: 'UQ1A.240205.004',
  },
}

export const PIXEL_8_PRO: DeviceProfile = {
  name: 'Pixel 8 Pro',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  mobile: true,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 448, height: 998, dpr: 3 },
  viewport: { width: 448, height: 998 },
  touchPoints: 5,
  hasTouch: true,
  hardwareConcurrency: 9,
  deviceMemory: 12,
  webglVendor: 'Google Inc. (Google)',
  webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (ARM Immortalis-G715 MC10 (0xA8E00000)), ARM driver-r46p0)',
  webglUnmaskedVendor: 'ARM',
  webglUnmaskedRenderer: 'Immortalis-G715 MC10',
  android: {
    deviceModel: 'Pixel 8 Pro',
    androidVersion: '14',
    apiLevel: 34,
    chromeMajor: 148,
    buildId: 'UQ1A.240205.004',
  },
}

export const SAMSUNG_S23: DeviceProfile = {
  name: 'Samsung Galaxy S23',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  mobile: true,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 360, height: 780, dpr: 3 },
  viewport: { width: 360, height: 780 },
  touchPoints: 10,
  hasTouch: true,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  webglVendor: 'Google Inc. (Qualcomm)',
  webglRenderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2 V@676.18 (GIT@a1b67ee))',
  webglUnmaskedVendor: 'Qualcomm',
  webglUnmaskedRenderer: 'Adreno (TM) 740',
  android: {
    deviceModel: 'SM-S911U',
    androidVersion: '14',
    apiLevel: 34,
    chromeMajor: 148,
    buildId: 'UP1A.231005.007',
  },
}

export const IPHONE_14_PRO: DeviceProfile = {
  name: 'iPhone 14 Pro',
  // Note: iOS Chrome uses CriOS (WebKit, not Blink). For real iPhone spoofing
  // you'd need an actual WebKit engine — this profile spoofs Safari-on-Chrome.
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  mobile: true,
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 393, height: 852, dpr: 3 },
  viewport: { width: 393, height: 852 },
  touchPoints: 5,
  hasTouch: true,
  hardwareConcurrency: 6,
  deviceMemory: 6,
  webglVendor: 'Apple Inc.',
  webglRenderer: 'Apple GPU',
  webglUnmaskedVendor: 'Apple Inc.',
  webglUnmaskedRenderer: 'Apple A16 GPU',
}

export const IPAD_PRO: DeviceProfile = {
  name: 'iPad Pro 12.9"',
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'iPad',
  mobile: false, // iPad reports mobile=false in modern Safari
  brand: 'Google Chrome',
  brandVersion: '148',
  fullVersion: '148.0.7654.123',
  screen: { width: 1024, height: 1366, dpr: 2 },
  viewport: { width: 1024, height: 1366 },
  touchPoints: 10,
  hasTouch: true,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  webglVendor: 'Apple Inc.',
  webglRenderer: 'Apple GPU',
  webglUnmaskedVendor: 'Apple Inc.',
  webglUnmaskedRenderer: 'Apple M2 GPU',
}

export const DEVICES: Record<string, DeviceProfile> = {
  'Desktop Win': DESKTOP_WIN_CHROME,
  'Desktop Mac': DESKTOP_MAC_CHROME,
  'Desktop Linux': DESKTOP_LINUX_CHROME,
  'Pixel 7': PIXEL_7,
  'Pixel 8 Pro': PIXEL_8_PRO,
  'Samsung Galaxy S23': SAMSUNG_S23,
  'iPhone 14 Pro': IPHONE_14_PRO,
  'iPad Pro': IPAD_PRO,
}

export function getDevice(name: string | DeviceProfile): DeviceProfile {
  if (typeof name === 'object') return name
  const d = DEVICES[name]
  if (!d) throw new Error(`Unknown device profile: ${name}. Available: ${Object.keys(DEVICES).join(', ')}`)
  return d
}
