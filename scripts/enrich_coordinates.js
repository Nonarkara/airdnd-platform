#!/usr/bin/env node
// Retired. This script filled missing coordinates with hand-typed area
// constants ("Bangkok, Thailand" → the city centre, "ลาดพร้าว 71" → one point),
// which the map then showed as if they were the shops' real locations.
//
// Use scripts/relocate_listings.js instead: it re-resolves each listing's own
// Google Maps link and places the rest from their own address, at the
// precision the address actually supports. See tasks/supabase-exit.md.
console.error('Retired — run: node scripts/relocate_listings.js (dry run) then --apply');
process.exit(1);
