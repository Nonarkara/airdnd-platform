#!/usr/bin/env node
import { syncVisitorLogsToSheet } from './google_export.js';

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : 1000;

await syncVisitorLogsToSheet({
  limit: Number.isFinite(limit) && limit > 0 ? limit : 1000,
});
