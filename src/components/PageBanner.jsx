import './PageBanner.css';

/**
 * Full-bleed themed hero for key pages.
 * Brand lives HERE — never also in the sticky header on the same viewport
 * (duplicate wordmarks read amateur). Text sits on a translucent panel so
 * the collage stays visible without fighting the type.
 */
function PageBanner({
  image,
  tone = 'light',
  compact = false,
  children,
  className = '',
  ariaLabelledBy,
}) {
  return (
    <section
      className={`page-banner page-banner--${tone}${compact ? ' page-banner--compact' : ''} ${className}`.trim()}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className="page-banner__media"
        style={{ backgroundImage: `url(${image})` }}
        role="img"
        aria-hidden="true"
      />
      <div className="page-banner__veil" aria-hidden="true" />
      <div className="page-banner__frame">
        <div className="page-banner__panel">{children}</div>
      </div>
    </section>
  );
}

export default PageBanner;
