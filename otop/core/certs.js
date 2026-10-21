/**
 * Certificate identity.
 *
 * The identity of a certificate is its number and its dates.
 *
 * The มผช. holder list is snapshotted by several agencies, and they do not
 * fill the columns in the same way: one filing carries the standard number
 * ("417/2558") and another carries only the standard's name ("CLOTH BAGS"),
 * for the same certificate, with the same number and the same dates. Keyed on
 * every field, those two filings look like two certificates — and the dossier
 * then prints the same certificate twice, once with the code and once
 * without it.
 *
 * So the identity is number + issued + expires; the standard code is an
 * attribute of how a certificate was filed, not of what it is. The richer
 * filing wins, because it carries more of the certificate.
 *
 * A certificate with no number has no identity to speak of, so those fall
 * back to the full field key: two unnumbered certificates are only the same
 * certificate if every field agrees.
 *
 * This lives on its own, without the rest of the record builder, because the
 * browser needs it to print certificates the built shards still carry twice.
 */

export function dedupeCerts(certs) {
  const out = [];
  const seen = new Map();
  for (const cert of certs ?? []) {
    if (!cert) continue;
    const key = cert.number
      ? [cert.number, cert.issued, cert.expires].join('|')
      : [cert.standardCode, cert.standardTitle, cert.issued, cert.expires].join('|');
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push({ ...cert });
      continue;
    }
    const kept = out[at];
    for (const field of ['standardCode', 'standardTitle', 'issued', 'expires']) {
      if (!kept[field] && cert[field]) kept[field] = cert[field];
    }
  }
  return out;
}
