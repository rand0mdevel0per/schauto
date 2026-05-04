// GMS environment spoofing test (Pixel 7 + Google sign-up surface check)
const {Browser} = require('../dist')

async function main() {
  console.log('Launching as Pixel 7 with GMS spoof...')
  const b = await Browser.launch({
    proxy: 'http://127.0.0.1:7890',
    device: 'Pixel 7',
    gms: true,
    timezone: 'Asia/Tokyo',
    language: 'ja-JP',
  })
  try {
    const c = await b.newContext()
    const p = await c.newPage()
    await p.goto('about:blank')
    await new Promise(r => setTimeout(r, 1000))

    const env = await p.evaluate(`(() => ({
      // Web APIs that real Android Chrome exposes
      hasChrome: typeof window.chrome === 'object',
      hasChromeRuntime: typeof window.chrome?.runtime === 'object',
      hasChromeApp: typeof window.chrome?.app === 'object',
      hasBattery: typeof navigator.getBattery === 'function',
      hasVibrate: typeof navigator.vibrate === 'function',
      hasDeviceOrientation: typeof window.DeviceOrientationEvent !== 'undefined',
      hasDeviceMotion: typeof window.DeviceMotionEvent !== 'undefined',
      // Mobile detection
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      pointerFine: matchMedia('(pointer: fine)').matches,
      hoverNone: matchMedia('(hover: none)').matches,
      hoverHover: matchMedia('(hover: hover)').matches,
      // Network connection
      connectionType: navigator.connection?.type,
      connectionEffective: navigator.connection?.effectiveType,
      // Screen orientation
      orientationType: screen.orientation?.type,
      // Device-specific identifiers (schauto-private)
      schautoGms: window.__schauto_gms,
    }))()`)
    console.log(JSON.stringify(env, null, 2))

    // Try a real google site that probes mobile-ness
    console.log('\n--- Testing Google account signup detection ---')
    try {
      await Promise.race([
        p.goto('https://accounts.google.com/signup/v2/webcreateaccount?flowName=GlifWebSignIn'),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 30000)),
      ])
      const title = await p.evaluate('document.title')
      const url = await p.evaluate('location.href')
      console.log('Title:', title)
      console.log('URL:', url)
      const png = await p.image.screenshot()
      require('fs').writeFileSync('gms-google-signup.png', png)
      console.log(`Screenshot saved (${png.length} bytes) → gms-google-signup.png`)
    } catch (e) {
      console.log('Google signup test:', e.message)
    }
  } finally {
    await b.close()
  }
}

main().catch(e => { console.error('FAIL', e); process.exit(1) })
