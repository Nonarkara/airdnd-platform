/**
 * ViewHero — the masthead every view but Find opens with.
 *
 * Each view answers one question; this is where the question is named. An
 * eyebrow (the question), a headline (the answer), and a stake (why it
 * matters and what to do next). All three accept nodes so callers pass
 * bilingual <Bi> copy like every other surface on the site.
 *
 * The headline is the page's h1. There is exactly one of them per view and
 * it is the largest type on the page — everything below it is smaller.
 */

export default function ViewHero({ eyebrow, headline, stake }) {
  return (
    <div className="vhero">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="vhero-h">{headline}</h1>
      {stake && <p className="vhero-stake">{stake}</p>}
    </div>
  );
}
