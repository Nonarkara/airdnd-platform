const POSITIVE_AVAILABILITY_RE = /(?:คิวว่าง|ว่างตอนนี้|ว่างวันนี้|ว่างแล้ว|พร้อมให้บริการ|available\s*(?:now|today)|slots?\s+available|walk[ -]?ins?\s+welcome)/i;
const NEGATIVE_AVAILABILITY_RE = /(?:คิวเต็ม|เต็มแล้ว|ไม่ว่าง|ปิดวันนี้|fully\s+booked|no\s+(?:slots?|availability)|closed\s+today)/i;
const FRESH_SIGNAL_MS = 6 * 60 * 60 * 1000;

function getListingTimestamp(listing) {
  const value = listing?.postedAt || listing?.posted_at || listing?.updatedAt
    || listing?.updated_at || listing?.createdAt || listing?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function parseOpeningHours(hours) {
  const text = String(hours || '').trim();
  if (!text) return null;
  if (/(?:24\s*(?:hours?|hrs?)|เปิด24ชม|เปิด\s*24)/i.test(text)) {
    return { startMinutes: 0, endMinutes: 24 * 60 };
  }

  const match = text.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|\u2013|\u2014|ถึง|to)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
  if (!match) return null;

  const startHour = Number(match[1]);
  const startMinute = Number(match[2] || 0);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4] || 0);
  if (startHour > 24 || endHour > 24 || startMinute > 59 || endMinute > 59) return null;

  return {
    startMinutes: Math.min(startHour, 24) * 60 + startMinute,
    endMinutes: Math.min(endHour, 24) * 60 + endMinute,
  };
}

export function isOpenAt(hours, date = new Date()) {
  const range = parseOpeningHours(hours);
  if (!range) return null;
  if (range.startMinutes === 0 && range.endMinutes === 24 * 60) return true;

  // Thai venues operate in Thailand local time (Asia/Bangkok, UTC+7).
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const currentMinutes = (hour % 24) * 60 + minute;

  const { startMinutes, endMinutes } = range;
  if (startMinutes === endMinutes) return true;
  if (endMinutes > startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function getAvailability(listing, now = Date.now()) {
  const sourceText = [listing?.description, listing?.rawText, listing?.raw_text]
    .filter(Boolean)
    .join(' ');
  const timestamp = getListingTimestamp(listing);
  const ageMs = timestamp ? Math.max(0, now - timestamp) : Number.POSITIVE_INFINITY;
  const fresh = ageMs <= FRESH_SIGNAL_MS;
  const open = isOpenAt(listing?.hours, new Date(now));
  const storedStatus = String(
    listing?.metrics?.availability_status || listing?.metrics?.availabilityStatus || '',
  ).toLowerCase();

  if (fresh && storedStatus === 'unavailable') {
    return { state: 'unavailable', label: 'Unavailable', open, ageMs, rank: 0 };
  }
  if (fresh && storedStatus === 'available' && open !== false) {
    const staffCount = Number(listing?.metrics?.available_staff_count);
    const label = Number.isInteger(staffCount) && staffCount > 0
      ? `${staffCount} available now`
      : 'Available now';
    return { state: 'available', label, open, ageMs, rank: 3 };
  }

  if (fresh && NEGATIVE_AVAILABILITY_RE.test(sourceText)) {
    return { state: 'unavailable', label: 'Unavailable', open, ageMs, rank: 0 };
  }
  if (fresh && POSITIVE_AVAILABILITY_RE.test(sourceText) && open !== false) {
    return { state: 'available', label: 'Available now', open, ageMs, rank: 3 };
  }
  if (open === true) {
    return { state: 'open', label: 'Open · check slot', open, ageMs, rank: 2 };
  }
  if (open === false) {
    return { state: 'closed', label: 'Closed now', open, ageMs, rank: 0 };
  }
  return { state: 'unknown', label: 'Check availability', open, ageMs, rank: 1 };
}

export function distanceKm(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return Number.POSITIVE_INFINITY;
  const [lat1, lng1] = from.map(Number);
  const [lat2, lng2] = to.map(Number);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatFreshness(timestamp, now = Date.now()) {
  if (!timestamp) return 'Waiting for live sync';
  const ageSeconds = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000));
  if (ageSeconds < 15) return 'Updated just now';
  if (ageSeconds < 60) return `Updated ${ageSeconds}s ago`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}
