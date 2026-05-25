import { useEffect, useRef, useState } from 'react';
import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  getSafeListingGalleryUrls,
} from '../lib/listings';
import {
  formatTelLink,
  formatTelDisplay,
  formatLineUrl,
  formatTelegramUrl,
  formatMapsUrl,
} from '../lib/normalization';
import { trackSignal, isListingSaved } from '../lib/tracker';
import './CompanionModal.css';

function CompanionModal({ companion, onClose, t }) {
  const contentRef = useRef(null);
  const [imageState, setImageState] = useState({
    companionId: companion?.id || null,
    url: null,
  });
  const [savedOverrides, setSavedOverrides] = useState({});
  const [copied, setCopied] = useState(false);
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const [reported, setReported] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  const galleryUrls = getSafeListingGalleryUrls(companion);
  const activeIndex = (() => {
    if (!galleryUrls.length) return -1;
    if (imageState.companionId === companion?.id && imageState.url) {
      const idx = galleryUrls.indexOf(imageState.url);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })();
  const goToIndex = (idx) => {
    if (!galleryUrls.length || !companion) return;
    const wrapped = ((idx % galleryUrls.length) + galleryUrls.length) % galleryUrls.length;
    setImageState({ companionId: companion.id, url: galleryUrls[wrapped] });
    setMainImageFailed(false);
  };

  useEffect(() => {
    if (!companion) return;

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
  }, [companion, onClose, activeIndex, galleryUrls.length]);

  if (!companion) return null;

  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.modal.timestampPending;
  const sourceLabel = companion.sourceChannel || SOURCE_LABELS[companion.dataSource];
  const activeImageUrl = imageState.companionId === companion.id
    ? imageState.url
    : galleryUrls[0];
  const displayImageUrl = activeImageUrl || galleryUrls[0] || null;
  const hasDisplayImage = Boolean(displayImageUrl);
  const saved = companion.id
    ? savedOverrides[companion.id] ?? isListingSaved(companion.id)
    : false;

  const shareUrl = `${window.location.origin}/?listing=${encodeURIComponent(companion.id)}`;

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
    await trackSignal(companion.id, 'report_explicit', { reason: 'explicit_content' });
  };

  const handleCopyPhone = async () => {
    const raw = companion.phone || '';
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

  const telHref = formatTelLink(companion.phone);
  const telDisplay = formatTelDisplay(companion.phone) || companion.phone;
  const lineHref = formatLineUrl(companion.lineUrl);
  const telegramHref = formatTelegramUrl(companion.telegramUrl);
  const mapsHref = formatMapsUrl(companion.mapsUrl, companion.latitude, companion.longitude);

  const mentions = Number(companion.mentionCount) || 0;
  const tags = Array.isArray(companion.serviceTags) ? companion.serviceTags : [];
  const feedback = (companion.userFeedbackSummary || '').trim();
  const channel = (companion.sourceChannel || '').replace(/^@/, '');
  const firstSeen = companion.createdAt ? new Date(companion.createdAt) : null;
  const lastUpdate = companion.updatedAt ? new Date(companion.updatedAt) : null;
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
        aria-label={companion.name}
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
                  alt={companion.name}
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
                          setImageState({ companionId: companion.id, url });
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
                {companion.postedAt
                  ? `Posted ${formatRelativeTimestamp(companion.postedAt)}`
                  : formatRelativeTimestamp(companion.updatedAt)}
              </span>
            </div>

            <h2 className="modal-name">{companion.name}</h2>

            <div className="modal-location">
              <span>{companion.location}</span>
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
                <span className="metric-value">{companion.hours || '—'}</span>
                <span className="metric-label">Hours</span>
              </div>
              <div className="metric-box">
                <span className="metric-value">{companion.priceLabel || 'On request'}</span>
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
                  const ok = await trackSignal(companion.id, 'save');
                  if (ok) {
                    setSavedOverrides((current) => ({ ...current, [companion.id]: true }));
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {saved ? (t?.signal?.saved || 'Saved') : (t?.signal?.save || 'Save')}
              </button>
              {companion.phone && (
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
              <p>{companion.description}</p>
            </div>

            <div className="modal-tags">
              {(companion.tags.length > 0 ? companion.tags : [t.card.pendingTag]).map((tag) => (
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

export default CompanionModal;
