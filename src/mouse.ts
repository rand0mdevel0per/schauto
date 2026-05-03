import { CDPClient } from './cdp-client'

interface Point { x: number; y: number }

// Cubic bezier interpolation
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u**3*p0.x + 3*u**2*t*p1.x + 3*u*t**2*p2.x + t**3*p3.x,
    y: u**3*p0.y + 3*u**2*t*p1.y + 3*u*t**2*p2.y + t**3*p3.y,
  }
}

function jitter(v: number, amount = 2): number {
  return v + (Math.random() - 0.5) * amount
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export class Mouse {
  private pos: Point = { x: 0, y: 0 }

  constructor(private cdp: CDPClient, private sessionId: string) {}

  private send(method: string, params: object) {
    return this.cdp.send(method, params, this.sessionId)
  }

  // Move mouse along bezier curve with jitter
  async move(target: Point, steps = 25): Promise<void> {
    const from = this.pos
    // Random control points for natural curve
    const cp1: Point = {
      x: from.x + (target.x - from.x) * 0.3 + (Math.random() - 0.5) * 80,
      y: from.y + (target.y - from.y) * 0.1 + (Math.random() - 0.5) * 80,
    }
    const cp2: Point = {
      x: from.x + (target.x - from.x) * 0.7 + (Math.random() - 0.5) * 80,
      y: from.y + (target.y - from.y) * 0.9 + (Math.random() - 0.5) * 80,
    }
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const p = bezier(from, cp1, cp2, target, t)
      const pt = { x: jitter(p.x), y: jitter(p.y) }
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: pt.x, y: pt.y,
      })
      await sleep(8 + Math.random() * 12)
    }
    this.pos = target
  }

  async click(target: Point): Promise<void> {
    await this.move(target)
    // Small pre-click jitter
    const pt = { x: jitter(target.x, 1), y: jitter(target.y, 1) }
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1,
    })
    await sleep(50 + Math.random() * 100)
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1,
    })
  }

  async scroll(target: Point, deltaY: number): Promise<void> {
    await this.move(target)
    // Break scroll into small steps
    const steps = Math.ceil(Math.abs(deltaY) / 100)
    const step = deltaY / steps
    for (let i = 0; i < steps; i++) {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: this.pos.x, y: this.pos.y,
        deltaX: 0, deltaY: step + (Math.random() - 0.5) * 10,
      })
      await sleep(30 + Math.random() * 40)
    }
  }
}
