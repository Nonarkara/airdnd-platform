/**
 * A LINK THAT IS ALSO A BUTTON.
 *
 * The header navigation used to be six <button> elements. A button does
 * something to the page; a link goes somewhere. That difference is invisible
 * to a person with a mouse and it is the whole difference to a crawler: a
 * crawler follows links and cannot press buttons, so a site whose only
 * navigation is buttons is a site with no link graph — every view of it
 * undiscoverable except the one a reader happened to land on, and no
 * crawler on earth can tell that `/history/` and `/atlas/` are two
 * documents rather than one.
 *
 * So the nav items are real anchors now, pointing at the path a view
 * lives on. The click is still handled in the page, so the site stays a
 * single-page application and the reader never waits for a load. If the
 * script does not run, the link still goes to the right document.
 */

import { pathFor } from '../lib/routes.js';

export default function NavLink({ view, code = null, current = false, onNavigate, children, ...rest }) {
  return (
    <a
      href={pathFor(view, code)}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => {
        // A modified click is the reader asking the browser to do something
        // else with the link — open it in a new tab, download it, copy it.
        // The page must not swallow it.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
