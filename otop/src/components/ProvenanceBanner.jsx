/**
 * The provenance banner is not decoration and is not dismissible.
 *
 * The wellness project shipped a LIVE tab that was a byte-for-byte copy of its
 * directory for six days, because a fallback quietly changed the meaning of a
 * file and wrote it to the same name (tasks/lessons.md · 2026-08-24). The fix
 * there, and the rule here, is that data which is not what a reader would
 * assume must say so on the page — not in a log, not in a commit message.
 */
export default function ProvenanceBanner({ meta }) {
  if (!meta) return null;

  if (meta.degraded) {
    return (
      <div className="prov degraded" role="status">
        <p className="prov-h">Synthetic data — not the national registry</p>
        {/* The reason string from otop_meta.json already carries the remedy.
            Do not restate it here — the banner said it twice for one build and
            read like a stutter. */}
        <p className="prov-b">{meta.reason}</p>
      </div>
    );
  }

  const retrieved = meta.builtAt ? new Date(meta.builtAt).toISOString().slice(0, 10) : 'unknown';
  return (
    <div className="prov">
      <p className="prov-h">Provenance</p>
      <p className="prov-b">
        Built {retrieved} from {meta.counts.resourcesUsable} of {meta.counts.resourcesCached} tabular
        resources published on <code>{meta.portal}</code>. {meta.counts.rowsIn.toLocaleString()} source
        rows in, {meta.counts.rowsRejected.toLocaleString()} rejected by the quality gate,{' '}
        {meta.counts.duplicatesCollapsed.toLocaleString()} duplicates collapsed by entity resolution.
        Every record below carries the dataset it came from.
        {meta.counts.resourcesAggregateEconomic != null && (
          <>
            {' '}{meta.counts.resourcesAggregateEconomic} of the {meta.counts.resourcesSkipped} skipped
            resources are sales or revenue aggregates: counted here, used in the Revenue section,
            never as producers.
          </>
        )}
      </p>
    </div>
  );
}
