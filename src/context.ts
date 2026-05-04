import { CDPClient } from './cdp-client'
import { GeoInfo } from './geo-resolver'
import { Page } from './page'
import { DeviceProfile } from './devices'
import { GmsConfig, buildGmsPreScript } from './gms'

export class BrowserContext {
  constructor(
    private cdp: CDPClient,
    private contextId: string,
    private geo: GeoInfo,
    private device: DeviceProfile,
    private gms: GmsConfig | null = null,
  ) {}

  async newPage(): Promise<Page> {
    const { targetId } = await this.cdp.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId: this.contextId,
    })
    const { sessionId } = await this.cdp.send('Target.attachToTarget', {
      targetId, flatten: true,
    })

    // ============================================================
    // Device emulation: viewport, DPR, touch, mobile flag
    // ============================================================
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: this.device.viewport.width,
      height: this.device.viewport.height,
      deviceScaleFactor: this.device.screen.dpr,
      mobile: this.device.mobile,
      screenWidth: this.device.screen.width,
      screenHeight: this.device.screen.height,
    }, sessionId).catch(() => {})

    if (this.device.hasTouch) {
      await this.cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: this.device.touchPoints,
      }, sessionId).catch(() => {})
      // Mobile devices need touch event handlers
      await this.cdp.send('Emulation.setEmitTouchEventsForMouse', {
        enabled: true,
        configuration: 'mobile',
      }, sessionId).catch(() => {})
    }

    // ============================================================
    // Locale / timezone / geolocation
    // ============================================================
    await this.cdp.send('Emulation.setTimezoneOverride', {
      timezoneId: this.geo.timezone,
    }, sessionId).catch(() => {})

    await this.cdp.send('Emulation.setLocaleOverride', {
      locale: this.geo.language,
    }, sessionId).catch(() => {})

    await this.cdp.send('Emulation.setGeolocationOverride', {
      latitude: this.geo.latitude,
      longitude: this.geo.longitude,
      accuracy: 100,
    }, sessionId).catch(() => {})

    // ============================================================
    // User-Agent + Client Hints (sec-ch-ua-* headers)
    // ============================================================
    const d = this.device
    await this.cdp.send('Emulation.setUserAgentOverride', {
      userAgent: d.userAgent,
      acceptLanguage: this.geo.language,
      platform: d.platform,
      userAgentMetadata: {
        brands: [
          { brand: 'Not-A.Brand', version: '99' },
          { brand: 'Chromium', version: d.brandVersion },
          { brand: d.brand, version: d.brandVersion },
        ],
        fullVersionList: [
          { brand: 'Not-A.Brand', version: '99.0.0.0' },
          { brand: 'Chromium', version: d.fullVersion },
          { brand: d.brand, version: d.fullVersion },
        ],
        fullVersion: d.fullVersion,
        platform: d.platform.startsWith('Win') ? 'Windows' :
                  d.platform === 'MacIntel' ? 'macOS' :
                  d.platform === 'iPhone' || d.platform === 'iPad' ? 'iOS' :
                  d.platform.startsWith('Linux arm') || d.android ? 'Android' :
                  'Linux',
        platformVersion: d.android?.androidVersion ?? '14.0.0',
        architecture: d.platform.includes('arm') || d.android ? 'arm' : 'x86',
        model: d.android?.deviceModel ?? '',
        mobile: d.mobile,
        bitness: '64',
        wow64: false,
      },
    }, sessionId).catch(() => {})

    // ============================================================
    // JS-level patches injected pre-document
    // For things CDP can't fix: hardwareConcurrency, deviceMemory,
    // navigator.plugins, etc. Runs BEFORE any page script.
    // ============================================================
    const preScripts = [this.buildPreScript()]
    if (this.gms) {
      preScripts.push(buildGmsPreScript(this.gms))
    }
    await this.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: preScripts.join('\n'),
    }, sessionId).catch(() => {})

    return new Page(this.cdp, sessionId)
  }

  private buildPreScript(): string {
    const d = this.device
    // Build IIFE that overrides Navigator properties before any page JS runs.
    // Use Object.defineProperty on the prototype so descriptor introspection
    // returns native-looking { configurable: true, get: ƒ } instead of ad-hoc fakes.
    return `
(() => {
  const def = (obj, key, value) => Object.defineProperty(obj, key, { get: () => value, configurable: true });

  // navigator.hardwareConcurrency
  def(Navigator.prototype, 'hardwareConcurrency', ${d.hardwareConcurrency});

  // navigator.deviceMemory
  ${d.deviceMemory ? `def(Navigator.prototype, 'deviceMemory', ${d.deviceMemory});` : ''}

  // navigator.maxTouchPoints
  def(Navigator.prototype, 'maxTouchPoints', ${d.touchPoints});

  // navigator.platform (CDP setUserAgentOverride doesn't always cover this)
  def(Navigator.prototype, 'platform', ${JSON.stringify(d.platform)});

  // navigator.webdriver — defense-in-depth (CLI flag should already cover, but)
  def(Navigator.prototype, 'webdriver', false);

  // navigator.plugins / mimeTypes — must be non-empty PluginArray for desktop Chrome
  ${!d.mobile ? `
  const fakePlugin = (name, filename, desc) => Object.create(Plugin.prototype, {
    name: { value: name }, filename: { value: filename }, description: { value: desc }, length: { value: 1 }
  });
  const plugins = [
    fakePlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
    fakePlugin('Chrome PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
    fakePlugin('Chromium PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
  ];
  Object.setPrototypeOf(plugins, PluginArray.prototype);
  def(Navigator.prototype, 'plugins', plugins);` : ''}

  // Screen dimensions (CDP setDeviceMetricsOverride covers but client hints may not)
  def(Screen.prototype, 'width', ${d.screen.width});
  def(Screen.prototype, 'height', ${d.screen.height});
  def(Screen.prototype, 'availWidth', ${d.screen.width});
  def(Screen.prototype, 'availHeight', ${d.screen.height - (d.mobile ? 0 : 40)});
  def(Screen.prototype, 'colorDepth', 24);
  def(Screen.prototype, 'pixelDepth', 24);

  // ===== Mobile / Android-specific =====
  ${d.android ? `
  // window.AndroidStub — some sites probe for Android-specific objects
  // (Not full GMS — see GMS docs in README for limitations)
  ` : ''}

  // ===== iOS-specific =====
  ${d.platform === 'iPhone' || d.platform === 'iPad' ? `
  // iOS Safari-specific globals
  window.GestureEvent = window.GestureEvent || function GestureEvent() {};
  ` : ''}

  // WebGL spoof (works without recompile via JS proxy on getParameter)
  // The C++ FingerprintToolkit hook will take over once patches are active.
  const _getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 0x1F00 /* VENDOR */) return ${JSON.stringify(d.webglVendor)};
    if (p === 0x1F01 /* RENDERER */) return ${JSON.stringify(d.webglRenderer)};
    if (p === 0x9245 /* UNMASKED_VENDOR_WEBGL */) return ${JSON.stringify(d.webglUnmaskedVendor)};
    if (p === 0x9246 /* UNMASKED_RENDERER_WEBGL */) return ${JSON.stringify(d.webglUnmaskedRenderer)};
    return _getParameter.call(this, p);
  };
  // Also patch WebGL2
  if (window.WebGL2RenderingContext) {
    WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
  }

  // Canvas noise (JS-layer fallback). Adds ±1 noise to each channel before toDataURL.
  // Real C++ patch in FingerprintToolkit will be more robust.
  const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    try {
      const ctx = this.getContext('2d');
      if (ctx) {
        const w = this.width, h = this.height;
        if (w > 0 && h > 0) {
          const img = ctx.getImageData(0, 0, w, h);
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i]     = Math.min(255, Math.max(0, img.data[i]     + (Math.random() < 0.5 ? -1 : 1)));
            img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + (Math.random() < 0.5 ? -1 : 1)));
            img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + (Math.random() < 0.5 ? -1 : 1)));
          }
          ctx.putImageData(img, 0, 0);
        }
      }
    } catch (e) { /* canvas tainted by cross-origin image, skip */ }
    return _toDataURL.apply(this, args);
  };

  // AudioContext channel data noise
  if (window.AudioBuffer) {
    const _getChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(ch) {
      const data = _getChannelData.call(this, ch);
      // Add tiny noise (±1e-7) — inaudible but breaks fingerprint
      for (let i = 0; i < data.length; i += 100) {
        data[i] += (Math.random() - 0.5) * 1e-7;
      }
      return data;
    };
  }
})();
`.trim()
  }

  async close() {
    await this.cdp.send('Target.disposeBrowserContext', {
      browserContextId: this.contextId,
    })
  }
}
