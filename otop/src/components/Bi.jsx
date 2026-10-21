/**
 * Shared presentational leaves: the bilingual chip.
 *
 * Moved out of App.jsx so the shell holds state and routing only. No logic
 * changed — cut verbatim.
 */

/**
 * Bilingual chip. English is the primary, Thai sits underneath in the
 * Sao Chingcha cut. `lang="th"` on the Thai span so a screen reader
 * pronounces it correctly (without it, TTS reads Thai letters as if
 * they were Latin, producing nonsense).
 */
export function Bi({ en, th, as: As = 'span' }) {
  return (
    <As className="bi">
      <span className="bi-en">{en}</span>
      {th != null && <span className="bi-th" lang="th">{th}</span>}
    </As>
  );
}
