const {Browser} = require('./dist')

async function main() {
  const b = await Browser.launch({
    proxy: 'http://127.0.0.1:7890',
    timezone: 'Asia/Tokyo', language: 'ja-JP', platform: 'Win32',
  })
  try {
    const c = await b.newContext()
    const p = await c.newPage()
    await p.goto('https://tls.peet.ws/api/all')
    await new Promise(r => setTimeout(r, 3000))
    const json = await p.evaluate('document.body.innerText')
    const data = JSON.parse(json)
    console.log('Full TLS fingerprint:')
    console.log('  IP:', data.ip)
    console.log('  HTTP:', data.http_version)
    console.log('  UA:', data.user_agent)
    console.log('  TLS JA3:', data.tls?.ja3)
    console.log('  TLS JA3 hash:', data.tls?.ja3_hash)
    console.log('  TLS JA4:', data.tls?.ja4)
    console.log('  TLS peetprint:', data.tls?.peetprint?.slice(0, 80))
    console.log('  HTTP2 fingerprint:', data.http2?.akamai_fingerprint?.slice(0, 80))
    console.log('  Cipher count:', data.tls?.ciphers?.length)
    console.log('  Akamai HTTP2:', data.http2?.akamai_fingerprint_hash)
  } finally {
    await b.close()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
