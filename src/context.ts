import { CDPClient } from './cdp-client'
import { GeoInfo } from './geo-resolver'
import { Page } from './page'

export class BrowserContext {
  constructor(
    private cdp: CDPClient,
    private contextId: string,
    private geo: GeoInfo
  ) {}

  async newPage(): Promise<Page> {
    const { targetId } = await this.cdp.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId: this.contextId,
    })
    const { sessionId } = await this.cdp.send('Target.attachToTarget', {
      targetId, flatten: true,
    })

    // CDP-native fingerprint emulation (works without recompiled FingerprintToolkit).
    // These cover what Puppeteer/Playwright do; FingerprintToolkit will add Canvas/WebGL/Audio noise on top once the C++ patches are wired up.
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

    // navigator.userAgent override — match Win/Mac/Linux to spoofed platform
    const uaPlatformPart =
      this.geo.platform === 'MacIntel' ? '(Macintosh; Intel Mac OS X 10_15_7)' :
      this.geo.platform.startsWith('Linux') ? '(X11; Linux x86_64)' :
      '(Windows NT 10.0; Win64; x64)'
    await this.cdp.send('Emulation.setUserAgentOverride', {
      userAgent: `Mozilla/5.0 ${uaPlatformPart} AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36`,
      acceptLanguage: this.geo.language,
      platform: this.geo.platform,
    }, sessionId).catch(() => {})

    return new Page(this.cdp, sessionId)
  }

  async close() {
    await this.cdp.send('Target.disposeBrowserContext', {
      browserContextId: this.contextId,
    })
  }
}
