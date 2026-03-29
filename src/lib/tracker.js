import { supabase } from './supabase.js'

const SESSION_KEY = 'sabai_session_id'
const GEO_KEY = 'sabai_geo'
let sessionId = null
let geo = null

function getSessionId() {
  if (sessionId) return sessionId
  sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

async function fetchGeo() {
  const cached = sessionStorage.getItem(GEO_KEY)
  if (cached) {
    geo = JSON.parse(cached)
    return
  }
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)
    const resp = await fetch('http://ip-api.com/json/?fields=country,city,lat,lon', {
      signal: controller.signal,
    })
    const data = await resp.json()
    geo = {
      country: data.country || null,
      city: data.city || null,
      latitude: data.lat || null,
      longitude: data.lon || null,
    }
    sessionStorage.setItem(GEO_KEY, JSON.stringify(geo))
  } catch {
    geo = {}
  }
}

function basePayload() {
  return {
    session_id: getSessionId(),
    referrer: document.referrer || null,
    user_agent: navigator.userAgent || null,
    language: navigator.language || null,
    screen_w: screen.width || null,
    screen_h: screen.height || null,
    country: geo?.country || null,
    city: geo?.city || null,
    latitude: geo?.latitude || null,
    longitude: geo?.longitude || null,
  }
}

export function trackPageView(page) {
  supabase
    .from('page_views')
    .insert({ ...basePayload(), page, event_type: 'pageview' })
    .then(() => {})
    .catch(() => {})
}

export function trackListingClick(listingId) {
  supabase
    .from('page_views')
    .insert({
      ...basePayload(),
      page: window.location.hash || '/',
      listing_id: listingId,
      event_type: 'listing_click',
    })
    .then(() => {})
    .catch(() => {})
}

function endSession() {
  const url = `https://fehdtfncbutesgadjsxp.supabase.co/rest/v1/page_views`
  const body = JSON.stringify({
    ...basePayload(),
    page: window.location.hash || '/',
    event_type: 'session_end',
  })
  try {
    fetch(url, {
      method: 'POST',
      headers: {
        apikey: 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF',
        Authorization: 'Bearer sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF',
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body,
      keepalive: true,
    })
  } catch {}
}

export async function initSession() {
  getSessionId()
  await fetchGeo()
  trackPageView(window.location.hash || '/')

  window.addEventListener('hashchange', () => {
    trackPageView(window.location.hash || '/')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endSession()
  })
  window.addEventListener('beforeunload', endSession)
}
