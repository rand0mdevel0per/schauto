import { spawn, ChildProcess } from 'child_process'
import { resolve } from 'path'
import { CDPClient } from './cdp-client'
import { resolveProxyGeo, GeoInfo } from './geo-resolver'
import { BrowserContext } from './context'

export interface LaunchOptions {
  proxy?: string
  executablePath?: string
}

export class Browser {
  private proc: ChildProcess
  private cdp: CDPClient
  private geo: GeoInfo

  private constructor(proc: ChildProcess, cdp: CDPClient, geo: GeoInfo) {
    this.proc = proc
    this.cdp = cdp
    this.geo = geo
  }

  static async launch(opts: LaunchOptions = {}): Promise<Browser> {
    const geo = opts.proxy
      ? await resolveProxyGeo(opts.proxy)
      : { timezone: 'America/New_York', language: 'en-US', platform: 'Win32',
          latitude: 37.77, longitude: -122.41, country_code: 'US' }

    const bin = opts.executablePath
      ?? resolve(__dirname, '../chromium-src/src/out/Release/chrome.exe')

    const args = [
      '--no-window',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--load-extension=${resolve(__dirname, '../extensions/adblock-plus')}`,
      `--fingerprint-timezone=${geo.timezone}`,
      `--fingerprint-language=${geo.language}`,
      `--fingerprint-platform=${geo.platform}`,
    ]
    if (opts.proxy) args.push(`--proxy-server=${opts.proxy}`)

    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

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
    return new Browser(proc, cdp, geo)
  }

  async newContext(): Promise<BrowserContext> {
    const { browserContextId } = await this.cdp.send('Target.createBrowserContext')
    return new BrowserContext(this.cdp, browserContextId, this.geo)
  }

  async close() {
    await this.cdp.send('Browser.close').catch(() => {})
    this.proc.kill()
  }
}
