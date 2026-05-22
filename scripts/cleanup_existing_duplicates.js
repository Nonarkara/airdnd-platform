import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildCanonicalKey,
  mergeCanonicalGroup,
} from '../src/lib/listing_contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanupDuplicates() {
  console.log('\n=== CLEANUP EXISTING DUPLICATES ===\n');

  try {
    // Step 1: Load all listings
    console.log('📥 Loading all listings from Supabase...');
    const { data: listings, error: fetchError } = await supabase
      .from('companions')
      .select('*')
      .limit(10000);

    if (fetchError) {
      console.error('❌ Failed to fetch listings:', fetchError);
      process.exit(1);
    }

    console.log(`✓ Loaded ${listings.length} listings\n`);

    // Step 2: Group by canonical key
    console.log('🔍 Analyzing for duplicates...');
    const groupsByCanonicalKey = new Map();
    const unidentifiable = [];

    listings.forEach((listing) => {
      const canonicalKey = listing.canonical_key || buildCanonicalKey(listing);

      if (!canonicalKey || canonicalKey === '') {
        unidentifiable.push(listing);
        return;
      }

      if (!groupsByCanonicalKey.has(canonicalKey)) {
        groupsByCanonicalKey.set(canonicalKey, []);
      }
      groupsByCanonicalKey.get(canonicalKey).push(listing);
    });

    // Step 3: Identify duplicate groups
    const duplicateGroups = Array.from(groupsByCanonicalKey.entries())
      .filter(([_, group]) => group.length > 1);

    console.log(`\n📊 Analysis Results:`);
    console.log(`   Total listings: ${listings.length}`);
    console.log(`   Unique identities: ${groupsByCanonicalKey.size}`);
    console.log(`   Duplicate groups: ${duplicateGroups.length}`);
    console.log(`   Total duplicates: ${duplicateGroups.reduce((sum, [_, g]) => sum + (g.length - 1), 0)}`);
    console.log(`   Unidentifiable: ${unidentifiable.length}`);

    if (duplicateGroups.length === 0) {
      console.log('\n✅ No duplicates found! Database is clean.');
      return;
    }

    // Step 4: Show duplicate groups
    console.log('\n📋 Duplicate Groups:\n');
    let groupIndex = 1;
    const mergedListings = [];

    for (const [canonicalKey, group] of duplicateGroups) {
      console.log(`Group ${groupIndex} (${group.length} listings):`);
      console.log(`  Canonical Key: ${canonicalKey}`);
      group.forEach((listing, idx) => {
        console.log(`    [${idx + 1}] "${listing.name}" @ ${listing.location || 'N/A'} | Created: ${listing.created_at}`);
      });

      // Merge the group
      try {
        const merged = mergeCanonicalGroup(group);
        console.log(`  ✓ Merged → "${merged.name}"`);
        console.log(`    Photos: ${merged.allPhotoUrls?.length || 0} | Mentions: ${merged.mentionCount}`);
        mergedListings.push({ merged, originals: group });
      } catch (error) {
        console.log(`  ❌ Merge failed: ${error.message}`);
      }

      console.log();
      groupIndex += 1;
    }

    // Step 5: Preview merges and ask for confirmation
    console.log('\n⚠️  CONFIRMATION REQUIRED\n');
    console.log(`About to delete ${duplicateGroups.reduce((sum, [_, g]) => sum + (g.length - 1), 0)} duplicate listings.`);
    console.log('The merged listings will retain all unique photos and metadata.');
    console.log('\nTo proceed with deletion, run with --confirm flag:');
    console.log('  node scripts/cleanup_existing_duplicates.js --confirm\n');

    if (!process.argv.includes('--confirm')) {
      console.log('ℹ️  DRY RUN COMPLETE (no changes made)\n');
      process.exit(0);
    }

    // Step 6: Execute merges (with --confirm flag)
    console.log('🔄 EXECUTING CLEANUP...\n');

    let deletedCount = 0;
    let updatedCount = 0;

    for (const { merged, originals } of mergedListings) {
      const survivor = originals[0]; // Keep the first one
      const toDelete = originals.slice(1);

      // Update survivor with merged data
      const { error: updateError } = await supabase
        .from('companions')
        .update({
          name: merged.name,
          description: merged.description,
          photo_urls: merged.allPhotoUrls,
          source_message_ids: merged.sourceMessageIds,
          mention_count: merged.mentionCount,
          service_tags: merged.serviceTags,
          user_rating: merged.userRating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', survivor.id);

      if (updateError) {
        console.error(`❌ Failed to update ${survivor.name}:`, updateError.message);
        continue;
      }

      updatedCount += 1;

      // Delete duplicates
      for (const dup of toDelete) {
        const { error: deleteError } = await supabase
          .from('companions')
          .delete()
          .eq('id', dup.id);

        if (deleteError) {
          console.error(`❌ Failed to delete ${dup.name}:`, deleteError.message);
        } else {
          deletedCount += 1;
          console.log(`  ✓ Deleted duplicate: "${dup.name}"`);
        }
      }
    }

    console.log(`\n✅ CLEANUP COMPLETE`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Deleted: ${deletedCount}`);
    console.log(`\nDatabase is now ready for unique constraints.\n`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
