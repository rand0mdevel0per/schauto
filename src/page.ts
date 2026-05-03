import { CDPClient } from './cdp-client'
import { Mouse } from './mouse'
import { ImageHelper } from './image'

export class Page {
  readonly mouse: Mouse
  readonly image: ImageHelper

  constructor(private cdp: CDPClient, private sessionId: string) {
    this.mouse = new Mouse(cdp, sessionId)
    this.image = new ImageHelper(cdp, sessionId)
  }

  private send(method: string, params: object = {}) {
    return this.cdp.send(method, params, this.sessionId)
  }

  async goto(url: string): Promise<void> {
    await this.send('Page.enable')
    await this.send('Page.navigate', { url })
    await new Promise<void>(res => this.cdp.on('Page.loadEventFired', res, this.sessionId))
  }

  async evaluate<T>(fn: string | Function, ...args: any[]): Promise<T> {
    const expr = typeof fn === 'function'
      ? `(${fn})(${args.map(a => JSON.stringify(a)).join(',')})`
      : fn
    const { result } = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    })
    return result.value
  }

  async $(selector: string): Promise<string | null> {
    const { result } = await this.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)}) ? true : false`,
      returnByValue: true,
    })
    return result.value ? selector : null
  }

  async screenshot(): Promise<Buffer> {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    return Buffer.from(data, 'base64')
  }

  async close(): Promise<void> {
    await this.send('Page.close')
  }
}
