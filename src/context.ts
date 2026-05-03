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
    return new Page(this.cdp, sessionId)
  }

  async close() {
    await this.cdp.send('Target.disposeBrowserContext', {
      browserContextId: this.contextId,
    })
  }
}
