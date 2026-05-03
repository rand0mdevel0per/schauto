import WebSocket from 'ws'

export class CDPClient {
  private ws: WebSocket
  private id = 0
  private pending = new Map<number, { resolve: Function; reject: Function }>()
  private listeners = new Map<string, Function[]>()

  constructor(ws: WebSocket) {
    this.ws = ws
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id)
        if (p) {
          this.pending.delete(msg.id)
          msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
        }
      } else if (msg.method) {
        const key = msg.sessionId ? `${msg.sessionId}:${msg.method}` : msg.method
        this.listeners.get(key)?.forEach(fn => fn(msg.params))
        this.listeners.get(msg.method)?.forEach(fn => fn(msg.params))
      }
    })
  }

  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      const msg: any = { id, method, params }
      if (sessionId) msg.sessionId = sessionId
      this.ws.send(JSON.stringify(msg))
    })
  }

  on(event: string, fn: Function, sessionId?: string) {
    const key = sessionId ? `${sessionId}:${event}` : event
    if (!this.listeners.has(key)) this.listeners.set(key, [])
    this.listeners.get(key)!.push(fn)
  }

  static async connect(url: string): Promise<CDPClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      ws.once('open', () => resolve(new CDPClient(ws)))
      ws.once('error', reject)
    })
  }
}
