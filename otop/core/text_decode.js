/**
 * Thai government CSV exports are frequently *not* UTF-8. Excel on a Thai
 * Windows locale writes TIS-620 / windows-874, and a naive utf-8 decode turns
 * every Thai column name and value into replacement characters — at which point
 * field mapping silently matches nothing and the ingest reports "0 rows" for a
 * file that is perfectly good. Detect and decode instead of failing quietly.
 *
 * TIS-620 is a single-byte set whose Thai block maps to Unicode with one
 * constant offset: 0xA1–0xFB → U+0E01–U+0E5B (+0x0D60). 0xDB–0xDE are unassigned.
 */

const TIS620_OFFSET = 0x0d60;

export function decodeTis620(buffer) {
  let out = '';
  for (const byte of buffer) {
    if (byte < 0x80) out += String.fromCharCode(byte);
    else if (byte >= 0xa1 && byte <= 0xfb && !(byte >= 0xdb && byte <= 0xde)) {
      out += String.fromCharCode(byte + TIS620_OFFSET);
    } else out += '�';
  }
  return out;
}

/**
 * Decode a downloaded buffer, choosing the encoding by evidence rather than by
 * assumption: strip any BOM, try UTF-8, and fall back to TIS-620 when the UTF-8
 * result carries replacement characters while high bytes in the TIS-620 Thai
 * range are present. Returns the text plus the encoding actually used, so the
 * ingest report can show it.
 */
export function decodeBuffer(buffer) {
  let buf = buffer;
  let bom = null;

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.subarray(3);
    bom = 'utf-8';
  } else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(buf.subarray(2)), encoding: 'utf-16le', bom: 'utf-16le' };
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(buf.subarray(2)), encoding: 'utf-16be', bom: 'utf-16be' };
  }

  const utf8 = new TextDecoder('utf-8').decode(buf);
  const replacements = (utf8.match(/�/g) || []).length;
  if (replacements === 0) return { text: utf8, encoding: 'utf-8', bom };

  const thaiBytes = buf.reduce((n, b) => n + (b >= 0xa1 && b <= 0xfb ? 1 : 0), 0);
  if (thaiBytes > 0) {
    const tis = decodeTis620(buf);
    const tisThai = (tis.match(/[ก-๛]/g) || []).length;
    // >= not >: a buffer that is *entirely* Thai yields exactly as many Thai
    // characters as it did replacement characters, and must still win.
    if (tisThai > 0 && tisThai >= replacements) return { text: tis, encoding: 'tis-620', bom };
  }

  return { text: utf8, encoding: 'utf-8', bom, lossy: replacements };
}

/**
 * RFC 4180 CSV parse: quoted fields, doubled quotes, embedded commas and
 * newlines, CRLF. Written out rather than pulled in because the ingest must run
 * from a plain `node scripts/...` with no install step, on a laptop, offline.
 */
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"' && field === '') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Pick the delimiter by counting candidates in the header line. */
export function sniffDelimiter(text) {
  const header = text.split('\n', 1)[0] ?? '';
  const counts = [',', ';', '\t', '|'].map((d) => [d, header.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export function csvToObjects(text) {
  const rows = parseCsv(text, sniffDelimiter(text));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.replace(/^﻿/, '').trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, i) => { obj[key] = cells[i] ?? ''; });
    return obj;
  });
}
