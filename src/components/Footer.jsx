import { formatRelativeTimestamp } from '../lib/listings';
import './Footer.css';

function Footer({ t, lastLoadedAt, sourceLabel }) {
  return (
    <footer className="airdnd-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="brand-mark">SS</span>
            <div>
              <strong>Sabai Sabai</strong>
              <p className="footer-tagline">{t.footer.tagline}</p>
            </div>
          </div>
        </div>

        <div className="footer-disclaimer">
          <h4>{t.footer.disclaimerTitle}</h4>
          <p>{t.footer.disclaimerText}</p>
        </div>

        <div className="footer-ops">
          <span>{t.footer.opsLabel}</span>
          <strong>{sourceLabel}</strong>
          <small>{formatRelativeTimestamp(lastLoadedAt)}</small>
        </div>
      </div>

      <div className="footer-bottom">
        <p>{t.footer.rights}</p>
        <div className="footer-links">
          <a href="#map">{t.footer.mapLink}</a>
          <a href="#workflow">{t.footer.workflowLink}</a>
          <a href="#live-listings">{t.footer.listingsLink}</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
