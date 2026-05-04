// Device profile verification
const {Browser, DEVICES} = require('../dist')

async function testDevice(deviceName) {
  console.log(`\n========== ${deviceName} ==========`)
  const b = await Browser.launch({
    proxy: 'http://127.0.0.1:7890',
    device: deviceName,
    timezone: 'Asia/Tokyo',
    language: 'ja-JP',
  })
  try {
    const c = await b.newContext()
    const p = await c.newPage()
    await p.goto('about:blank')
    await new Promise(r => setTimeout(r, 1000))
    const fp = await p.evaluate(`(() => ({
      ua: navigator.userAgent,
      platform: navigator.platform,
      mobile: navigator.userAgentData?.mobile,
      brands: navigator.userAgentData?.brands?.map(b => b.brand+'/'+b.version).join(','),
      hwc: navigator.hardwareConcurrency,
      mem: navigator.deviceMemory,
      maxTouch: navigator.maxTouchPoints,
      screenW: screen.width,
      screenH: screen.height,
      dpr: devicePixelRatio,
      webglVendor: (() => { const c=document.createElement('canvas'); const gl=c.getContext('webgl'); const e=gl?.getExtension('WEBGL_debug_renderer_info'); return e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null; })(),
      webglRenderer: (() => { const c=document.createElement('canvas'); const gl=c.getContext('webgl'); const e=gl?.getExtension('WEBGL_debug_renderer_info'); return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null; })(),
      canvas1: (() => { const c=document.createElement('canvas'); c.width=200; c.height=50; const ctx=c.getContext('2d'); ctx.fillStyle='#069'; ctx.fillText('test',2,15); return c.toDataURL().slice(-40); })(),
      canvas2: (() => { const c=document.createElement('canvas'); c.width=200; c.height=50; const ctx=c.getContext('2d'); ctx.fillStyle='#069'; ctx.fillText('test',2,15); return c.toDataURL().slice(-40); })(),
    }))()`)
    console.log('UA:', fp.ua)
    console.log('Platform:', fp.platform, '| Mobile:', fp.mobile, '| Brands:', fp.brands)
    console.log('HW:', `cpu=${fp.hwc} mem=${fp.mem}GB touch=${fp.maxTouch}`)
    console.log('Screen:', `${fp.screenW}x${fp.screenH} @${fp.dpr}x`)
    console.log('GPU:', `${fp.webglVendor} / ${fp.webglRenderer}`)
    console.log('Canvas hash differ?', fp.canvas1 !== fp.canvas2 ? '✅ YES (noise active)' : '❌ NO (still deterministic)')
    console.log('  c1:', fp.canvas1)
    console.log('  c2:', fp.canvas2)
  } finally {
    await b.close()
  }
}

async function main() {
  for (const name of ['Desktop Win', 'Pixel 7', 'iPhone 14 Pro', 'Samsung Galaxy S23']) {
    try {
      await testDevice(name)
    } catch (e) {
      console.error(`FAIL ${name}:`, e.message)
    }
  }
}
main().catch(e => { console.error('TOP FAIL', e); process.exit(1) })
