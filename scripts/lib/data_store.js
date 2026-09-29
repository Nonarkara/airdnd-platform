/**
 * One switch for every process that reads the listing store.
 *
 * The scraper already honours LOCAL_DB=1 (or DATA_STORE=local). The heartbeat
 * and the integrity check did not: after cutover they would have kept reading
 * Supabase — and on the day the project is cancelled, the process whose job is
 * to raise the alarm would itself fail on every run. They now open the same
 * store the scraper writes to, through the same Supabase-compatible shim.
 */

export function isLocalStore(env = process.env) {
  return /^(1|true|local|yes)$/i.test(env.LOCAL_DB || '') || /^local$/i.test(env.DATA_STORE || '');
}

/**
 * @param {string} who  names the caller in the error message
 * @returns {Promise<object>} a supabase-js client, or the local shim
 */
export async function openDataClient(who) {
  if (isLocalStore()) {
    // Imported lazily: node:sqlite prints an experimental warning on load, and
    // Supabase-mode runs have no reason to pay for it.
    const { openLocalDb } = await import('./local_store.js');
    const { createLocalSupabaseShim } = await import('./supabase_local_shim.js');
    return createLocalSupabaseShim(openLocalDb());
  }
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`${who}: set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env, or LOCAL_DB=1 to use the local store`);
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}
