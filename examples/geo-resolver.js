// Direct test of geo-resolver via JP proxy
const {resolveProxyGeo} = require('./dist/geo-resolver')
async function main() {
  console.log('Calling geo-resolver via http://127.0.0.1:7890 ...')
  const geo = await resolveProxyGeo('http://127.0.0.1:7890')
  console.log('Geo result:', JSON.stringify(geo, null, 2))
}
main().catch(e => console.error('FAIL', e))
