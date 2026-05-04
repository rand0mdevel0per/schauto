// Turnstile-only test on a known-working demo
const {Browser} = require('./dist')
const fs = require('fs')

async function main() {
  const b = await Browser.launch({
    proxy: 'http://127.0.0.1:7890',
    timezone: 'Asia/Tokyo',
    language: 'ja-JP',
    platform: 'Win32',
  })
  console.log('PID:', b.pid)
  try {
    const c = await b.newContext()
    const p = await c.newPage()

    // Cloudflare's own demo page
    const urls = [
      'https://nowsecure.nl',
      'https://tls.peet.ws/api/all',
    ]
    for (const url of urls) {
      console.log(`\n=== ${url} ===`)
      try {
        await Promise.race([
          p.goto(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('nav timeout')), 25000))
        ])
        await new Promise(r => setTimeout(r, 5000))
        const info = await p.evaluate(`(() => {
          return {
            title: document.title,
            url: location.href,
            bodyText: document.body ? document.body.innerText.slice(0, 200) : null,
            iframeCount: document.querySelectorAll('iframe').length,
            cfRayHeader: document.cookie.includes('__cf_bm') || document.cookie.includes('cf_clearance'),
            cookies: document.cookie.length > 0,
          };
        })()`)
        console.log(JSON.stringify(info, null, 2))
        const png = await p.image.screenshot()
        const fname = url.replace(/[^\w]/g, '_') + '.png'
        fs.writeFileSync(fname, png)
        console.log(`screenshot → ${fname} (${png.length} bytes)`)
      } catch (e) {
        console.log('error:', e.message)
      }
    }
  } finally {
    await b.close()
    console.log('closed')
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
