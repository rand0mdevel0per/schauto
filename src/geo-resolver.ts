import { ProxyAgent } from 'proxy-agent'

export interface GeoInfo {
  timezone: string
  language: string
  platform: string
  latitude: number
  longitude: number
  country_code: string
}

// Platform mapping by country
const PLATFORM_MAP: Record<string, string> = {
  US: 'Win32', GB: 'Win32', CA: 'MacIntel', AU: 'MacIntel',
  DE: 'Win32', FR: 'Win32', JP: 'Win32', CN: 'Win32',
}

// Language mapping by country
const LANGUAGE_MAP: Record<string, string> = {
  US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
  DE: 'de-DE', FR: 'fr-FR', JP: 'ja-JP', CN: 'zh-CN',
  HK: 'zh-HK', TW: 'zh-TW', SG: 'en-SG', KR: 'ko-KR',
}

const FALLBACK: GeoInfo = {
  timezone: 'America/New_York', language: 'en-US', platform: 'Win32',
  latitude: 37.7749, longitude: -122.4194, country_code: 'US',
}

async function tryProvider(url: string, agent: any): Promise<any | null> {
  try {
    const res = await fetch(url, {
      // @ts-ignore
      agent,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const text = await res.text()
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) return JSON.parse(text)
    return null
  } catch { return null }
}

export async function resolveProxyGeo(proxy: string): Promise<GeoInfo> {
  const agent = new ProxyAgent({ getProxyForUrl: () => proxy })

  // Try ip-api.com (free, no auth, JSON), then ipwho.is, then ipapi.co
  const a = await tryProvider('http://ip-api.com/json/?fields=status,country,countryCode,timezone,lat,lon,query', agent)
  if (a && a.status === 'success') {
    return {
      timezone: a.timezone || FALLBACK.timezone,
      language: LANGUAGE_MAP[a.countryCode] || 'en-US',
      platform: PLATFORM_MAP[a.countryCode] || 'Win32',
      latitude: a.lat ?? FALLBACK.latitude,
      longitude: a.lon ?? FALLBACK.longitude,
      country_code: a.countryCode || 'US',
    }
  }

  const b = await tryProvider('https://ipwho.is/', agent)
  if (b && b.success !== false) {
    return {
      timezone: b.timezone?.id || FALLBACK.timezone,
      language: LANGUAGE_MAP[b.country_code] || 'en-US',
      platform: PLATFORM_MAP[b.country_code] || 'Win32',
      latitude: b.latitude ?? FALLBACK.latitude,
      longitude: b.longitude ?? FALLBACK.longitude,
      country_code: b.country_code || 'US',
    }
  }

  const c = await tryProvider('https://ipapi.co/json/', agent)
  if (c && !c.error) {
    return {
      timezone: c.timezone || FALLBACK.timezone,
      language: (c.languages || 'en-US').split(',')[0],
      platform: PLATFORM_MAP[c.country_code] || 'Win32',
      latitude: c.latitude ?? FALLBACK.latitude,
      longitude: c.longitude ?? FALLBACK.longitude,
      country_code: c.country_code || 'US',
    }
  }

  return FALLBACK
}
