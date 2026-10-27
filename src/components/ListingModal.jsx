import { useEffect, useRef, useState } from 'react';
import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  getSafeListingGalleryUrls,
  computeGreyScore,
  getMapsStatus,
} from '../lib/listings';

const GREY_META = {
  legit:     { label: 'LIKELY LEGIT',  color: '#34d399' },
  ambiguous: { label: 'AMBIGUOUS',     color: '#948499' },
  grey:      { label: 'GREY SIGNAL',   color: '#f59e0b' },
  strong:    { label: 'STRONG GREY',   color: '#ff7440' },
};
const SIGNAL_WEIGHT = { strong: '▲▲', medium: '▲', low: '·', green: '▼' };
import {
  formatTelLink,
  formatTelDisplay,
  formatLineUrl,
  formatTelegramUrl,
  formatMapsUrl,
} from '../lib/normalization';
import { trackSignal, isListingSaved } from '../lib/tracker';
import { listingCoords, getNearestTransit } from '../lib/geo';
import { channelLabel, channelSlug } from '../lib/channel';
import './ListingModal.css';

function ListingModal({ listing, onClose, t }) {
  const contentRef = useRef(null);
  const [imageState, setImageState] = useState({
    listingId: listing?.id || null,
    url: null,
  });
  const [savedOverrides, setSavedOverrides] = useState({});
  const [copied, setCopied] = useState(false);
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const [reported, setReported] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const coordsInfo = listingCoords(listing);
  const transit = coordsInfo ? getNearestTransit(coordsInfo.coords) : null;
  const thaiScript = `สวัสดีครับ สอบถามคิวว่างช่วงเวลานี้ครับ มีน้องคนไหนพร้อมให้บริการบ้างครับ? (จาก Sabai Sabai - ${listing?.name || ''})`;

  const galleryUrls = getSafeListingGalleryUrls(listing);
  const archiveSlug = channelSlug(listing?.sourceChannel);
  const archiveHref = archiveSlug && archiveSlug !== 'unknown' ? `/places/${archiveSlug}` : null;
  const activeIndex = (() => {
    if (!galleryUrls.length) return -1;
    if (imageState.listingId === listing?.id && imageState.url) {
      const idx = galleryUrls.indexOf(imageState.url);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })();
  const goToIndex = (idx) => {
    if (!galleryUrls.length || !listing) return;
    const wrapped = ((idx % galleryUrls.length) + galleryUrls.length) % galleryUrls.length;
    setImageState({ listingId: listing.id, url: galleryUrls[wrapped] });
    setMainImageFailed(false);
  };

  useEffect(() => {
    if (!listing) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (galleryUrls.length > 1) {
        if (e.key === 'ArrowRight') { e.preventDefault(); goToIndex(activeIndex + 1); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); goToIndex(activeIndex - 1); return; }
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    const closeBtn = contentRef.current?.querySelector('.btn-close');
    closeBtn?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing, onClose, activeIndex, galleryUrls.length]);

  if (!listing) return null;

  const preciseTimestamp = formatPreciseTimestamp(listing.postedAt)
    || formatPreciseTimestamp(listing.updatedAt)
    || t.modal.timestampPending;
  const sourceLabel = listing.sourceChannel || SOURCE_LABELS[listing.dataSource];
  const activeImageUrl = imageState.listingId === listing.id
    ? imageState.url
    : galleryUrls[0];
  const displayImageUrl = activeImageUrl || galleryUrls[0] || null;
  const hasDisplayImage = Boolean(displayImageUrl);
  const saved = listing.id
    ? savedOverrides[listing.id] ?? isListingSaved(listing.id)
    : false;

  const shareUrl = `${window.location.origin}/?listing=${encodeURIComponent(listing.id)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReportPhoto = async () => {
    setReported(true);
    await trackSignal(listing.id, 'report_explicit', { reason: 'explicit_content' });
  };

  const handleCopyPhone = async () => {
    const raw = listing.phone || '';
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = raw;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    }
  };

  const telHref = formatTelLink(listing.phone);
  const telDisplay = formatTelDisplay(listing.phone) || listing.phone;
  const lineHref = formatLineUrl(listing.lineUrl);
  const telegramHref = formatTelegramUrl(listing.telegramUrl);
  const mapsHref = formatMapsUrl(listing.mapsUrl, listing.latitude, listing.longitude, {
    precision: listing.geoPrecision, name: listing.name, location: listing.location,
  });

  const grey = computeGreyScore(listing);
  const greyMeta = GREY_META[grey.level] || GREY_META.ambiguous;
  const mapsStatus = getMapsStatus(listing);

  const mentions = Number(listing.mentionCount) || 0;
  const tags = Array.isArray(listing.serviceTags) ? listing.serviceTags : [];
  const feedback = (listing.userFeedbackSummary || '').trim();
  const channel = channelLabel(listing.sourceChannel);
  const firstSeen = listing.createdAt ? new Date(listing.createdAt) : null;
  const lastUpdate = listing.updatedAt ? new Date(listing.updatedAt) : null;
  const fmt = (d) => d && !isNaN(d.getTime())
    ? d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={contentRef}
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={listing.name}
      >
        <button type="button" className="btn-close" onClick={onClose} aria-label={t.modal.close}>
          ×
        </button>

        <div className="modal-body">
          <div className="modal-image-section">
            {hasDisplayImage && !mainImageFailed && !reported ? (
              <div className="modal-gallery">
                <img
                  src={displayImageUrl}
                  alt={listing.name}
                  className="modal-main-image"
                  onError={() => setMainImageFailed(true)}
                />
                {galleryUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="modal-photo-nav modal-photo-nav-prev"
                      onClick={() => goToIndex(activeIndex - 1)}
                      aria-label="Previous photo"
                    >‹</button>
                    <button
                      type="button"
                      className="modal-photo-nav modal-photo-nav-next"
                      onClick={() => goToIndex(activeIndex + 1)}
                      aria-label="Next photo"
                    >›</button>
                    <span className="modal-photo-counter">
                      {activeIndex + 1} / {galleryUrls.length}
                    </span>
                  </>
                )}

                {galleryUrls.length > 1 && (
                  <div className="modal-thumbnails">
                    {galleryUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className={`modal-thumb ${url === activeImageUrl ? 'active' : ''}`}
                        onClick={() => {
                          setImageState({ listingId: listing.id, url });
                          setMainImageFailed(false);
                        }}
                      />
                    ))}
                  </div>
                )}

                <button type="button" className="modal-report-btn" onClick={handleReportPhoto}>
                  Report explicit content
                </button>

                <div className="modal-image-stamp">
                  <span className="modal-image-stamp-label">{t.modal.capturedAt}</span>
                  <strong>{preciseTimestamp}</strong>
                </div>

                {archiveHref && (
                  <a
                    className="modal-archive-link"
                    href={archiveHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Full {channel || archiveSlug} photo archive →
                  </a>
                )}
              </div>
            ) : (
              <div className="modal-main-image modal-image-placeholder">
                <span>{mainImageFailed ? 'Image unavailable' : 'No image'}</span>
              </div>
            )}
          </div>

          <div className="modal-info-section">
            <div className="modal-topline">
              <span className="status-pill">{sourceLabel}</span>
              <span>
                {listing.postedAt
                  ? `Posted ${formatRelativeTimestamp(listing.postedAt)}`
                  : formatRelativeTimestamp(listing.updatedAt)}
              </span>
            </div>

            <h2 className="modal-name">{listing.name}</h2>

            <div className="modal-location">
              <span>{listing.location}</span>
              {transit && (
                <span className="modal-transit-badge" style={{ color: 'var(--data)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginLeft: '8px' }}>
                  {transit.tag}
                </span>
              )}
            </div>

            {/* Metrics grid */}
            <div className="metrics-grid">
              {telHref ? (
                <a href={telHref} className="metric-box metric-link">
                  <span className="metric-value">{telDisplay}</span>
                  <span className="metric-label">Phone</span>
                </a>
              ) : (
                <div className="metric-box">
                  <span className="metric-value">—</span>
                  <span className="metric-label">Phone</span>
                </div>
              )}
              <div className="metric-box">
                <span className="metric-value">{listing.hours || '—'}</span>
                <span className="metric-label">Hours</span>
              </div>
              <div className="metric-box">
                <span className="metric-value">{listing.priceLabel || 'On request'}</span>
                <span className="metric-label">{t.modal.rate}</span>
              </div>
            </div>

            {/* Community Signal */}
            {(mentions > 1 || tags.length > 0 || feedback || firstSeen) && (
              <div className="modal-signal-block">
                <span className="modal-signal-eyebrow">Community Signal</span>
                <div className="modal-signal-stats">
                  {mentions > 1 && (
                    <div className="modal-signal-stat">
                      <strong>{mentions}×</strong>
                      <span>mentions{channel ? ` on @${channel}` : ''}</span>
                    </div>
                  )}
                  {firstSeen && (
                    <div className="modal-signal-stat">
                      <strong>{fmt(firstSeen)}</strong>
                      <span>first seen</span>
                    </div>
                  )}
                  {lastUpdate && (
                    <div className="modal-signal-stat">
                      <strong>{fmt(lastUpdate)}</strong>
                      <span>last updated</span>
                    </div>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="modal-signal-tags">
                    {tags.map((tag) => (
                      <span key={tag} className="modal-signal-tag">{tag}</span>
                    ))}
                  </div>
                )}
                {feedback && (
                  <blockquote className="modal-signal-quote">
                    <span>{feedback}</span>
                    {channel && <cite>— extracted from @{channel}</cite>}
                  </blockquote>
                )}
              </div>
            )}

            {/* ── Intelligence Assessment ─────────────────────────── */}
            <div className="modal-intel">
              <span className="modal-intel-eyebrow">INTELLIGENCE ASSESSMENT</span>
              <div className="modal-intel-score">
                <span className="modal-intel-badge" style={{ color: greyMeta.color, borderColor: greyMeta.color }}>
                  {grey.score}%
                </span>
                <div className="modal-intel-verdict">
                  <strong style={{ color: greyMeta.color }}>{greyMeta.label}</strong>
                  <span>probability of non-standard service</span>
                </div>
                <a
                  className="modal-intel-maps"
                  href={mapsStatus.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={mapsStatus.status === 'confirmed' ? 'Maps confirmed by operator' : mapsStatus.status === 'coords' ? 'Geocoded location' : 'Name-based search'}
                >
                  {mapsStatus.status === 'confirmed' ? '✓ Maps' : mapsStatus.status === 'coords' ? '⊙ Map' : '? Search'}
                </a>
              </div>
              {grey.signals.length > 0 && (
                <ul className="modal-intel-signals">
                  {grey.signals.map((s, i) => (
                    <li key={i} className={`modal-intel-signal modal-intel-signal--${s.w}`}>
                      <span className="modal-intel-weight">{SIGNAL_WEIGHT[s.w] || '·'}</span>
                      {s.t}
                    </li>
                  ))}
                </ul>
              )}
              <p className="modal-intel-note">
                Scored against 12 signals from the grey market research. Baseline: 35% (corpus is ambiguous by design).{' '}
                <a href="/methodology" target="_blank" rel="noopener noreferrer">Methodology →</a>
              </p>
            </div>

            {/* 1-Tap Booking Inquiry Assistant */}
            <div className="modal-booking-assistant" style={{ margin: '16px 0', padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--mango)', fontWeight: 700 }}>💬 1-TAP INQUIRY SCRIPT (FOR LINE / CHAT)</span>
                {copiedScript && <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>✓ Copied!</span>}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>"{thaiScript}"</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ width: '100%', borderRadius: 0, fontSize: '11px', padding: '6px 12px' }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(thaiScript);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  } catch {
                    const el = document.createElement('textarea');
                    el.value = thaiScript;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }
                }}
              >
                Copy Thai Inquiry Script 📋
              </button>
            </div>

            {/* Contact buttons */}
            {(telHref || lineHref || telegramHref || mapsHref) && (
              <div className="modal-contact-row">
                {telHref && (
                  <a href={telHref} className="modal-contact-btn">
                    Call {telDisplay}
                  </a>
                )}
                {lineHref && (
                  <a href={lineHref} target="_blank" rel="noopener noreferrer" className="modal-contact-btn modal-contact-line">
                    LINE
                  </a>
                )}
                {telegramHref && (
                  <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="modal-contact-btn">
                    Telegram
                  </a>
                )}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="modal-contact-btn">
                    Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Actions row */}
            <div className="modal-signal-row">
              <button
                type="button"
                className={`modal-signal-btn${saved ? ' saved' : ''}`}
                onClick={async () => {
                  if (saved) return;
                  const ok = await trackSignal(listing.id, 'save');
                  if (ok) {
                    setSavedOverrides((current) => ({ ...current, [listing.id]: true }));
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {saved ? (t?.signal?.saved || 'Saved') : (t?.signal?.save || 'Save')}
              </button>
              {listing.phone && (
                <button
                  type="button"
                  className="modal-signal-btn"
                  onClick={handleCopyPhone}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {phoneCopied ? 'Copied' : 'Copy number'}
                </button>
              )}
              <button
                type="button"
                className="modal-signal-btn"
                onClick={handleCopyLink}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {copied ? 'Copied' : 'Share'}
              </button>
            </div>

            {/* Owner CTA */}
            <div className="modal-owner-hint">
              <span className="modal-owner-label">For business owners</span>
              <p>Is this your listing? <a href="mailto:hello@sabaisabai.dev?subject=Claim Listing" target="_blank" rel="noopener noreferrer">Claim or update it</a> to keep your information accurate.</p>
            </div>

            <div className="modal-description">
              <h3>{t.modal.about}</h3>
              <p>{listing.description}</p>
            </div>

            <div className="modal-tags">
              {(listing.tags.length > 0 ? listing.tags : [t.card.pendingTag]).map((tag) => (
                <span key={tag} className="pill-tag">
                  {tag}
                </span>
              ))}
            </div>

            <div className="modal-footer">
              <div className="modal-price-range">
                <span className="price-label">{t.modal.source}</span>
                <span className="price-value">{sourceLabel}</span>
              </div>
              <button type="button" className="btn-book" onClick={onClose}>
                {t.modal.closeCta}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ListingModal;
