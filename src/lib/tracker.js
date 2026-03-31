import { supabase } from './supabase.js'

const SESSION_KEY = 'sabai_session_id'
const GEO_KEY = 'sabai_geo'
const TRACKING_KEY = 'sabai_tracking_disabled'
let sessionId = null
let geo = null
let trackingDisabled = sessionStorage.getItem(TRACKING_KEY) === '1'

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

function disableTracking() {
  trackingDisabled = true
  sessionStorage.setItem(TRACKING_KEY, '1')
}

function isTrackingError(error) {
  return error && (error.code === 'PGRST205' || error.code === '42P01')
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
  if (trackingDisabled) return
  supabase
    .from('page_views')
    .insert({ ...basePayload(), page, event_type: 'pageview' })
    .then(({ error }) => {
      if (isTrackingError(error)) disableTracking()
    })
    .catch(() => {})
}

export function trackListingClick(listingId) {
  if (trackingDisabled) return
  supabase
    .from('page_views')
    .insert({
      ...basePayload(),
      page: window.location.hash || '/',
      listing_id: listingId,
      event_type: 'listing_click',
    })
    .then(({ error }) => {
      if (isTrackingError(error)) disableTracking()
    })
    .catch(() => {})
}

function endSession() {
  if (trackingDisabled) return
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

async function probeTable() {
  if (trackingDisabled) return
  try {
    const { error } = await supabase
      .from('page_views')
      .select('id')
      .limit(0)
    if (isTrackingError(error)) {
      disableTracking()
    }
  } catch {
    disableTracking()
  }
}

export async function initSession() {
  getSessionId()
  await Promise.all([fetchGeo(), probeTable()])
  if (trackingDisabled) return

  trackPageView(window.location.hash || '/')

  window.addEventListener('hashchange', () => {
    trackPageView(window.location.hash || '/')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endSession()
  })
  window.addEventListener('beforeunload', endSession)
}
