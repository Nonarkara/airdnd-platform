#!/usr/bin/env node
/**
 * Handle certification status calculations.
 */

import { certStatus } from '../../../otop/core/record.js';

export function calculateCertStatus(merged, certAsOf) {
  for (const record of merged) {
    record.certAsOf = record.certs.length > 0 ? certAsOf : null;
    record.certStatus = certStatus(record.certs, certAsOf);
  }
}

export function calculateCertStats(merged) {
  return {
    certified: merged.filter((r) => r.certs.length > 0).length,
    certValid: merged.filter((r) => r.certStatus === 'valid').length,
    certExpired: merged.filter((r) => r.certStatus === 'expired').length,
    certUnknown: merged.filter((r) => r.certStatus === 'unknown').length,
  };
}