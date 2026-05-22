-- Phase 2: Implement phone-based primary deduplication with database constraints
-- This migration adds phone_normalized column and creates unique indexes to enforce dedup
-- 2026-04-30

-- Step 0: Ensure canonical_key column exists (may not be in DB if 20260429 was never executed)
ALTER TABLE public.companions ADD COLUMN IF NOT EXISTS canonical_key TEXT;

-- Step 1: Add phone_normalized column (stores normalized phone for unique indexing)
ALTER TABLE public.companions ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Step 2: Backfill phone_normalized with normalized values
-- Extracts digits, converts 66-prefix to 0, truncates to 10 digits
UPDATE public.companions
SET phone_normalized = CASE
  -- Extract digits from original phone
  WHEN phone ~ '^\d+$' THEN
    CASE
      -- Convert 66 prefix to 0 if 11+ digits total
      WHEN phone ~ '^66' AND char_length(phone) >= 11 THEN
        '0' || substring(phone, 3, 10)
      -- Truncate to 10 digits if starts with 0 and longer
      WHEN phone ~ '^0' AND char_length(phone) > 10 THEN
        substring(phone, 1, 10)
      -- Keep as-is if valid 8-10 digits
      WHEN char_length(phone) >= 8 AND char_length(phone) <= 10 THEN
        phone
      -- Reject if too short
      ELSE NULL
    END
  -- For non-digit phone values, extract digits and normalize
  WHEN phone IS NOT NULL AND phone <> '' THEN
    CASE
      WHEN length(regexp_replace(phone, '\D', '', 'g')) >= 8 THEN
        CASE
          WHEN regexp_replace(phone, '\D', '', 'g') ~ '^66' THEN
            '0' || substring(regexp_replace(phone, '\D', '', 'g'), 3, 10)
          ELSE
            substring(regexp_replace(phone, '\D', '', 'g'), 1, 10)
        END
      ELSE NULL
    END
  ELSE NULL
END
WHERE phone IS NOT NULL AND phone <> '';

-- Step 3: Create unique index on phone_normalized (dedup by phone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companions_phone_normalized
  ON public.companions(phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

-- Step 4: Create unique index on canonical_key (dedup by identity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companions_canonical_key_unique
  ON public.companions(canonical_key)
  WHERE canonical_key IS NOT NULL AND canonical_key <> '';

-- Step 5: Drop old non-unique indexes (they're replaced by unique ones above)
DROP INDEX IF EXISTS idx_companions_phone_digits;
DROP INDEX IF EXISTS idx_companions_canonical_key;

-- Step 6: Create standard indexes for lookups
CREATE INDEX IF NOT EXISTS idx_companions_updated_at ON public.companions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_companions_city ON public.companions(city);
CREATE INDEX IF NOT EXISTS idx_companions_maps_url ON public.companions(maps_url);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.companions.phone_normalized IS 'Normalized phone number for deduplication (8-10 digits, 66 prefix converted to 0)';
COMMENT ON INDEX idx_companions_phone_normalized IS 'Unique index: one companion per normalized phone number';
COMMENT ON INDEX idx_companions_canonical_key_unique IS 'Unique index: one companion per canonical identity (maps/phone/line/name+location)';
