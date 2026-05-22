import { useState } from 'react';
import { trackSignal } from '../lib/tracker';
import './InquiryOverlay.css';

export default function InquiryOverlay({ listingId, listingName, onClose, t }) {
  const [contact, setContact] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!contact.trim() || sending) return;
    setSending(true);
    const ok = await trackSignal(listingId, 'inquire', { contact: contact.trim() });
    setSending(false);
    if (ok) setSent(true);
  }

  return (
    <div className="inquiry-overlay" onClick={onClose}>
      <div className="inquiry-panel" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="inquiry-done">
            <p className="inquiry-done-icon">&#10003;</p>
            <p>{t?.inquiry?.sent || 'Sent. The business will be notified.'}</p>
            <button type="button" className="inquiry-close-btn" onClick={onClose}>
              {t?.inquiry?.close || 'Close'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="inquiry-title">
              {t?.inquiry?.title || "I'm interested"}
            </p>
            <p className="inquiry-subtitle">
              {t?.inquiry?.subtitle || 'Leave your LINE ID or phone — we\'ll connect you with'}{' '}
              <strong>{listingName}</strong>
            </p>
            <input
              type="text"
              className="inquiry-input"
              placeholder={t?.inquiry?.placeholder || '@line_id or 08x-xxx-xxxx'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="inquiry-submit-btn"
              disabled={!contact.trim() || sending}
            >
              {sending
                ? (t?.inquiry?.sending || 'Sending...')
                : (t?.inquiry?.send || 'Send')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
