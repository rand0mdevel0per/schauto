// JP proxy comprehensive verification
// Tracks chrome PID, uses graceful close(), tests fingerprint + Turnstile
const {Browser} = require('./dist')
const fs = require('fs')

async function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT: ${label} after ${ms}ms`)), ms))
  ])
}

async function main() {
  console.log('=== schauto JP-proxy verification ===')
  console.log('Spawning chrome via 127.0.0.1:7890 with HARDCODED JP overrides...')
  const b = await Browser.launch({
    proxy: 'http://127.0.0.1:7890',
    timezone: 'Asia/Tokyo',
    language: 'ja-JP',
    platform: 'Win32',
    latitude: 35.6762,
    longitude: 139.6503,
    countryCode: 'JP',
  })
  console.log(`Chrome PID: ${b.pid} (only this PID will be terminated on close)`)

  try {
    const c = await b.newContext()
    const p = await c.newPage()

    // ===== Test 1: Fingerprint geo-match via JP proxy =====
    console.log('\n--- Test 1: Fingerprint vectors ---')
    await withTimeout(p.goto('about:blank'), 15000, 'about:blank')
    const fp = await withTimeout(p.evaluate(`({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: navigator.languages.join(','),
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      userAgent: navigator.userAgent.slice(0, 80),
      webdriver: navigator.webdriver,
      tzOffset: new Date().getTimezoneOffset(),
    })`), 5000, 'fingerprint eval')
    console.log(JSON.stringify(fp, null, 2))

    // Verify JP geo-match
    const expectedJP = fp.timezone === 'Asia/Tokyo' && fp.language.startsWith('ja')
    console.log(expectedJP ? '✅ JP geo-match WORKING (timezone+lang)' : '⚠️  JP geo-match NOT applied — got tz=' + fp.timezone + ' lang=' + fp.language)

    // ===== Test 2: Canvas fingerprint noise =====
    console.log('\n--- Test 2: Canvas noise (run twice, check if values differ) ---')
    const canvasHash = `(() => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('schauto-test', 2, 15);
      return c.toDataURL();
    })()`
    const h1 = await withTimeout(p.evaluate(canvasHash), 5000, 'canvas1')
    const h2 = await withTimeout(p.evaluate(canvasHash), 5000, 'canvas2')
    const differ = h1 !== h2
    console.log(`Canvas hash 1 (first 60 chars): ${h1.slice(0, 60)}...`)
    console.log(`Canvas hash 2 (first 60 chars): ${h2.slice(0, 60)}...`)
    console.log(differ ? '✅ Canvas noise WORKING (hashes differ)' : '⚠️  Canvas hashes IDENTICAL — noise patch may not be active')

    // ===== Test 3: WebGL vendor/renderer spoof =====
    console.log('\n--- Test 3: WebGL vendor/renderer ---')
    const webgl = await withTimeout(p.evaluate(`(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl');
      if (!gl) return { error: 'no webgl' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      };
    })()`), 5000, 'webgl')
    console.log(JSON.stringify(webgl, null, 2))

    // ===== Test 4: Cloudflare Turnstile (the big one) =====
    console.log('\n--- Test 4: Cloudflare Turnstile ---')
    try {
      await withTimeout(p.goto('https://nopecha.com/demo/turnstile'), 30000, 'turnstile demo')
      console.log('Loaded turnstile demo. Waiting 8s for challenge to render...')
      await new Promise(r => setTimeout(r, 8000))

      const turnstile = await withTimeout(p.evaluate(`(() => {
        const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        const checkbox = document.querySelector('input[name="cf-turnstile-response"]');
        const responseValue = checkbox ? checkbox.value : null;
        return {
          iframePresent: !!iframe,
          responseTokenLen: responseValue ? responseValue.length : 0,
          tokenPreview: responseValue ? responseValue.slice(0, 30) : null,
          challenges: document.body.innerText.toLowerCase().includes('challenge'),
        };
      })()`), 10000, 'turnstile eval')
      console.log(JSON.stringify(turnstile, null, 2))
      const passed = turnstile.responseTokenLen > 100
      console.log(passed ? '✅ Turnstile CHALLENGE PASSED (got token)' : '⚠️  Turnstile not yet solved (no token)')
    } catch (e) {
      console.log('⚠️  Turnstile test error:', e.message)
    }

    // ===== Test 5: Screenshot =====
    console.log('\n--- Test 5: Screenshot ---')
    try {
      const png = await withTimeout(p.image.screenshot(), 15000, 'screenshot')
      fs.writeFileSync('verify-jp.png', png)
      console.log(`✅ Screenshot saved (${png.length} bytes) → verify-jp.png`)
    } catch (e) {
      console.log('⚠️  Screenshot:', e.message)
    }

  } finally {
    console.log('\n--- Closing ---')
    await b.close()
    console.log(`Closed chrome PID ${b.pid}`)
  }
}

main().catch(e => { console.error('FAIL', e); process.exit(1) })
