/**
 * ViewHero — the excitement contract for every tab.
 *
 * Each view answers one question with one striking fact, then shows the data
 * that proves it. This is the shared header that makes that promise visible:
 * an eyebrow (the question), a headline (the fact), a stake (why it matters
 * and what to do next). All three accept nodes so callers pass bilingual
 * <Bi> copy like every other section header on the site.
 *
 * Reuses sec-h / sec-t / sec-n / filter-explain — zero new CSS, same voice.
 */

export default function ViewHero({ eyebrow, headline, stake }) {
  return (
    <>
      <div className="sec-h">
        <h2 className="sec-t">{headline}</h2>
        {eyebrow && <span className="sec-n">{eyebrow}</span>}
      </div>
      {stake && <p className="filter-explain">{stake}</p>}
    </>
  );
}
