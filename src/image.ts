import { CDPClient } from './cdp-client'

export class ImageHelper {
  constructor(private cdp: CDPClient, private sessionId: string) {}

  private send(method: string, params: object = {}) {
    return this.cdp.send(method, params, this.sessionId)
  }

  // Full page screenshot → Buffer
  async screenshot(): Promise<Buffer> {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    return Buffer.from(data, 'base64')
  }

  // Crop a region from screenshot (x, y, width, height)
  async screenshotRegion(x: number, y: number, w: number, h: number): Promise<Buffer> {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x, y, width: w, height: h, scale: 1 },
    })
    return Buffer.from(data, 'base64')
  }

  // Get bounding box of a selector → {x, y, width, height}
  async boundingBox(selector: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const { result } = await this.send('Runtime.evaluate', {
      expression: `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? {x:r.x,y:r.y,width:r.width,height:r.height} : null })()`,
      returnByValue: true,
    })
    return result.value ?? null
  }

  // Screenshot of a specific element
  async screenshotElement(selector: string): Promise<Buffer | null> {
    const box = await this.boundingBox(selector)
    if (!box) return null
    return this.screenshotRegion(box.x, box.y, box.width, box.height)
  }
}
