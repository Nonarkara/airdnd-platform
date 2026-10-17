import { db } from './firebase.js';
import { collection, addDoc, limit, query, getDocs } from 'firebase/firestore';

const SESSION_KEY = 'sabai_session_id';
const GEO_KEY = 'sabai_geo';
const TRACKING_KEY = 'sabai_tracking_disabled';
const EXTENDED_TRACKING_KEY = 'sabai_extended_tracking_disabled';
let sessionId = null;
let geo = null;
let trackingDisabled = sessionStorage.getItem(TRACKING_KEY) === '1';
let extendedTrackingDisabled = sessionStorage.getItem(EXTENDED_TRACKING_KEY) === '1';

function getSessionId() {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      // crypto.randomUUID() is available in all modern browsers but
      // throws in a few contexts: Safari ITP private mode, certain
      // embedded WebViews, and any page where `window.crypto` has been
      // disabled by a privacy extension. Fall back to a timestamp+random
      // string so the rest of the app keeps working.
      sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch (storageError) {
    // sessionStorage throws in Safari private mode and when storage
    // quotas are exceeded. We can still keep a per-tab id in memory.
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

async function fetchGeo() {
  const cached = sessionStorage.getItem(GEO_KEY);
  if (cached) {
    try {
      geo = JSON.parse(cached);
      return;
    } catch {
      // Corrupted cache (e.g. a previous version of the app stored a
      // different shape). Drop it and re-fetch rather than crashing
      // the whole app.
      try { sessionStorage.removeItem(GEO_KEY); } catch { /* ignore */ }
    }
  }
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2000);
    const resp = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    const data = await resp.json();
    geo = {
      ipAddress: data.ip || null,
      country: data.country_name || data.country || null,
      countryCode: data.country_code || data.country || null,
      region: data.region || data.region_code || null,
      city: data.city || null,
      latitude: data.latitude || data.lat || null,
      longitude: data.longitude || data.lon || null,
      timezone: data.timezone || data.utc_offset || null,
      org: data.org || data.asn || null,
    };
    try { sessionStorage.setItem(GEO_KEY, JSON.stringify(geo)); } catch { /* ignore quota errors */ }
  } catch {
    geo = {};
  }
}

function disableTracking() {
  trackingDisabled = true;
  sessionStorage.setItem(TRACKING_KEY, '1');
}

function disableExtendedTracking() {
  extendedTrackingDisabled = true;
  sessionStorage.setItem(EXTENDED_TRACKING_KEY, '1');
}

function stripExtendedVisitorFields(payload) {
  const {
    ip_address,
    country_code,
    region,
    timezone,
    org,
    ...basicPayload
  } = payload;

  return basicPayload;
}

function basePayload() {
  const payload = {
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
    created_at: new Date().toISOString(),
  };

  if (!extendedTrackingDisabled) {
    payload.ip_address = geo?.ipAddress || null;
    payload.country_code = geo?.countryCode || null;
    payload.region = geo?.region || null;
    payload.timezone = geo?.timezone || null;
    payload.org = geo?.org || null;
  }

  return payload;
}

async function insertPageView(payload) {
  try {
    await addDoc(collection(db, 'page_views'), payload);
  } catch (error) {
    disableTracking();
  }
}

export function trackPageView(page) {
  if (trackingDisabled) return;
  insertPageView({ ...basePayload(), page, event_type: 'pageview' }).catch(() => {});
}

export function trackListingClick(listingId) {
  if (trackingDisabled) return;
  insertPageView({
    ...basePayload(),
    page: window.location.hash || '/',
    listing_id: listingId,
    event_type: 'listing_click',
  }).catch(() => {});
}

function endSession() {
  if (trackingDisabled) return;
  insertPageView({
    ...(extendedTrackingDisabled ? stripExtendedVisitorFields(basePayload()) : basePayload()),
    page: window.location.hash || '/',
    event_type: 'session_end',
  }).catch(() => {});
}

async function probeTable() {
  if (trackingDisabled) return;
  try {
    const q = query(collection(db, 'page_views'), limit(1));
    await getDocs(q);
  } catch {
    disableTracking();
  }
}

// --- Demand signals (Phase 1: The Whisper) ---

const SAVES_KEY = 'sabai_saves';
let signalsDisabled = false;

function getSavedListings() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SAVES_KEY) || '[]'));
  } catch { return new Set(); }
}

function persistSaves(set) {
  sessionStorage.setItem(SAVES_KEY, JSON.stringify([...set]));
}

export function isListingSaved(listingId) {
  return getSavedListings().has(listingId);
}

export async function trackSignal(listingId, signalType, payload = {}) {
  if (trackingDisabled || signalsDisabled) return false;
  try {
    await addDoc(collection(db, 'signals'), {
      session_id: getSessionId(),
      listing_id: listingId,
      signal_type: signalType,
      payload,
      country: geo?.country || null,
      city: geo?.city || null,
      created_at: new Date().toISOString(),
    });
    if (signalType === 'save') {
      const saves = getSavedListings();
      saves.add(listingId);
      persistSaves(saves);
    }
    return true;
  } catch { 
    signalsDisabled = true;
    return false; 
  }
}

export async function unsaveSignal(listingId) {
  const saves = getSavedListings();
  saves.delete(listingId);
  persistSaves(saves);
}

export async function initSession() {
  getSessionId();
  await Promise.all([fetchGeo(), probeTable()]);
  if (trackingDisabled) return;

  trackPageView(window.location.hash || '/');

  window.addEventListener('hashchange', () => {
    trackPageView(window.location.hash || '/');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endSession();
  });
  window.addEventListener('beforeunload', endSession);
}
