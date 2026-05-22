import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  buildCanonicalKey,
  hasMatchedPublicMedia,
  normalizePublicListing,
  validatePublicListing,
} from '../src/lib/listing_contract.js';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://fehdtfncbutesgadjsxp.supabase.co';
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const source = sourceArg?.split('=')[1] || 'snapshot';
const strict = process.argv.includes('--strict');

const WARNING_FINDINGS = new Set([
  'fake-hours',
  'missing-coordinates',
]);

async function loadRows() {
  if (source === 'supabase') {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';
    const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from('companions').select('*').limit(1000);
    if (error) {
      throw new Error(`Supabase audit load failed: ${error.message}`);
    }
    return data || [];
  }

  const raw = fs.readFileSync('public/data.json', 'utf8');
  return JSON.parse(raw);
}

function addFinding(findings, type, row, details = {}) {
  findings.push({
    type,
    severity: WARNING_FINDINGS.has(type) ? 'warning' : 'error',
    id: row?.id,
    name: row?.name,
    location: row?.location,
    ...details,
  });
}

function hasFakeHours(row) {
  return /^24\/7$/i.test(String(row?.hours || '').trim());
}

function hasCoordinates(row) {
  return Number.isFinite(Number.parseFloat(row?.latitude)) &&
    Number.isFinite(Number.parseFloat(row?.longitude));
}

function auditRows(rows) {
  const findings = [];
  const canonicalGroups = new Map();

  rows.forEach((rawRow, index) => {
    const row = normalizePublicListing(rawRow, {
      source,
      allowUnverified: true,
    }) || rawRow;
    const validation = validatePublicListing(row);
    const canonicalKey = buildCanonicalKey(row);

    if (!validation.ok) {
      addFinding(findings, 'invalid-public-row', rawRow, { reason: validation.reason });
    }

    if (!canonicalKey) {
      addFinding(findings, 'missing-canonical-key', rawRow);
    } else {
      if (!canonicalGroups.has(canonicalKey)) {
        canonicalGroups.set(canonicalKey, []);
      }
      canonicalGroups.get(canonicalKey).push({ row: rawRow, index });
    }

    if (!hasCoordinates(row)) {
      addFinding(findings, 'missing-coordinates', rawRow);
    }

    if (hasFakeHours(row)) {
      addFinding(findings, 'fake-hours', rawRow);
    }

    if (source !== 'backup' && String(rawRow?.imageUrl || rawRow?.image_url || '').startsWith('/mockups/')) {
      addFinding(findings, 'mockup-image-in-public-data', rawRow);
    }

    if (source !== 'backup' && hasMatchedPublicMedia(row) && row.isSafeImage === false) {
      addFinding(findings, 'unsafe-image-visible', rawRow);
    }
  });

  canonicalGroups.forEach((group, canonicalKey) => {
    if (group.length <= 1) {
      return;
    }

    group.forEach(({ row }) => {
      addFinding(findings, 'duplicate-canonical-key', row, { canonicalKey, duplicateCount: group.length });
    });
  });

  return findings;
}

const rows = await loadRows();
const findings = auditRows(Array.isArray(rows) ? rows : []);
const errors = findings.filter((finding) => finding.severity === 'error');
const warnings = findings.filter((finding) => finding.severity === 'warning');
const summary = {
  source,
  strict,
  rows: Array.isArray(rows) ? rows.length : 0,
  findings: findings.length,
  errors: errors.length,
  warnings: warnings.length,
  exitReason: errors.length > 0
    ? 'error findings present'
    : strict && findings.length > 0
      ? 'strict mode treats warnings as failures'
      : null,
  bySeverity: findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {}),
  byType: findings.reduce((acc, finding) => {
    acc[finding.type] = (acc[finding.type] || 0) + 1;
    return acc;
  }, {}),
  samples: findings.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > 0 || (strict && findings.length > 0)) {
  process.exit(1);
}
