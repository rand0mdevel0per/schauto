import { spawn, ChildProcess } from 'child_process'
import { resolve } from 'path'
import { CDPClient } from './cdp-client'
import { resolveProxyGeo, GeoInfo } from './geo-resolver'
import { BrowserContext } from './context'
import { DeviceProfile, getDevice, DESKTOP_WIN_CHROME } from './devices'
import { GmsConfig } from './gms'

export interface LaunchOptions {
  proxy?: string
  executablePath?: string
  // Device profile (preset name or full custom DeviceProfile object)
  device?: string | DeviceProfile
  // GMS environment simulation (only meaningful for Android device profiles)
  gms?: boolean | Partial<Omit<GmsConfig, 'device'>>
  // Hard overrides (skip geo-resolver if any of these are provided)
  timezone?: string         // e.g. "Asia/Tokyo"
  language?: string         // e.g. "ja-JP"
  platform?: string         // "Win32" | "MacIntel" | "Linux x86_64"
  latitude?: number
  longitude?: number
  countryCode?: string
}

export class Browser {
  private proc: ChildProcess
  private cdp: CDPClient
  private geo: GeoInfo
  private device: DeviceProfile
  private gms: GmsConfig | null

  private constructor(proc: ChildProcess, cdp: CDPClient, geo: GeoInfo, device: DeviceProfile, gms: GmsConfig | null) {
    this.proc = proc
    this.cdp = cdp
    this.geo = geo
    this.device = device
    this.gms = gms
  }

  static async launch(opts: LaunchOptions = {}): Promise<Browser> {
    const device = opts.device ? getDevice(opts.device) : DESKTOP_WIN_CHROME

    const gms: GmsConfig | null = opts.gms && device.android
      ? { device, ...(typeof opts.gms === 'object' ? opts.gms : {}) }
      : null

    const hasOverride = opts.timezone || opts.language || opts.platform
    const baseGeo = opts.proxy && !hasOverride
      ? await resolveProxyGeo(opts.proxy)
      : { timezone: 'America/New_York', language: 'en-US', platform: device.platform,
          latitude: 37.77, longitude: -122.41, country_code: 'US' }

    // Apply overrides: explicit > geo > device default
    const geo: GeoInfo = {
      timezone: opts.timezone ?? baseGeo.timezone,
      language: opts.language ?? baseGeo.language,
      platform: opts.platform ?? baseGeo.platform ?? device.platform,
      latitude: opts.latitude ?? baseGeo.latitude,
      longitude: opts.longitude ?? baseGeo.longitude,
      country_code: opts.countryCode ?? baseGeo.country_code,
    }

    const bin = opts.executablePath
      ?? resolve(__dirname, '../chromium-src/src/out/Release/chrome.exe')

    const args = [
      // Use --headless=new (Chrome's modern headless mode) instead of patched --no-window
      // because --no-window breaks the compositor → Page.captureScreenshot hangs.
      // TODO: fix --no-window patch to keep off-screen rendering.
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Anti-automation flags (no recompile needed)
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-features=Translate,InterestFeedContentSuggestions,CalculateNativeWinOcclusion',
      // Locale override (Chrome reads --lang for navigator.language)
      `--lang=${geo.language}`,
      `--accept-lang=${geo.language},${geo.language.split('-')[0]},en`,
      // Device profile UA (overridden again per-context via CDP for safety)
      `--user-agent=${device.userAgent}`,
      // Custom flags read by FingerprintToolkit (when patches active)
      `--fingerprint-timezone=${geo.timezone}`,
      `--fingerprint-language=${geo.language}`,
      `--fingerprint-platform=${geo.platform}`,
      `--load-extension=${resolve(__dirname, '../extensions/adblock-plus')}`,
    ]
    // Device-specific flags
    if (device.mobile) {
      args.push(
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--use-mobile-user-agent',
      )
    }
    if (opts.proxy) args.push(`--proxy-server=${opts.proxy}`)

    // ICU reads TZ env var → makes Intl.DateTimeFormat() return spoofed timezone
    // even without recompiled FingerprintToolkit timezone hook.
    const env = {
      ...process.env,
      TZ: geo.timezone,
      LANG: `${geo.language.replace('-', '_')}.UTF-8`,
    }

    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })

    const wsUrl = await new Promise<string>((res, rej) => {
      let buf = ''
      proc.stderr!.on('data', (d: Buffer) => {
        buf += d.toString()
        const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/)
        if (m) res(m[1])
      })
      proc.once('exit', () => rej(new Error('Chrome exited before CDP ready')))
      setTimeout(() => rej(new Error('CDP timeout')), 15000)
    })

    const cdp = await CDPClient.connect(wsUrl)
    return new Browser(proc, cdp, geo, device, gms)
  }

  async newContext(): Promise<BrowserContext> {
    const { browserContextId } = await this.cdp.send('Target.createBrowserContext')
    return new BrowserContext(this.cdp, browserContextId, this.geo, this.device, this.gms)
  }

  async close() {
    await this.cdp.send('Browser.close').catch(() => {})
    this.proc.kill()
  }

  get pid(): number | undefined {
    return this.proc.pid
  }
}
