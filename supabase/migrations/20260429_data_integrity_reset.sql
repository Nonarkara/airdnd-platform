-- Data Integrity Reset: canonical public business rows.
-- Raw evidence remains in channel_messages and photo_archive.

ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS hours TEXT,
  ADD COLUMN IF NOT EXISTS line_url TEXT,
  ADD COLUMN IF NOT EXISTS telegram_url TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_safe_image BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS canonical_key TEXT;

CREATE INDEX IF NOT EXISTS idx_companions_canonical_key
  ON public.companions (canonical_key);

CREATE INDEX IF NOT EXISTS idx_companions_maps_url
  ON public.companions (maps_url);

CREATE INDEX IF NOT EXISTS idx_companions_phone_digits
  ON public.companions (regexp_replace(coalesce(phone, ''), '\D', '', 'g'));

CREATE INDEX IF NOT EXISTS idx_companions_updated_at
  ON public.companions (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.photo_archive (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_message_id BIGINT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    sender_id TEXT,
    message_date TIMESTAMPTZ,
    original_filename TEXT,
    stored_filename TEXT NOT NULL,
    local_path TEXT,
    supabase_url TEXT,
    file_size_bytes BIGINT,
    media_type TEXT,
    mime_type TEXT,
    photo_telegram_id TEXT,
    grouped_id TEXT,
    linked_companion_id BIGINT REFERENCES public.companions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, telegram_message_id, stored_filename)
);

CREATE INDEX IF NOT EXISTS idx_photo_archive_channel
  ON public.photo_archive (channel_id);

CREATE INDEX IF NOT EXISTS idx_photo_archive_message_date
  ON public.photo_archive (message_date DESC);

CREATE INDEX IF NOT EXISTS idx_photo_archive_companion
  ON public.photo_archive (linked_companion_id);

ALTER TABLE public.photo_archive ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'photo_archive'
      AND policyname = 'service_role_all_photo_archive'
  ) THEN
    CREATE POLICY "service_role_all_photo_archive"
      ON public.photo_archive
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'photo_archive'
      AND policyname = 'authenticated_select_photo_archive'
  ) THEN
    CREATE POLICY "authenticated_select_photo_archive"
      ON public.photo_archive
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create the unique canonical index only after cleanup/backfill:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_companions_canonical_key_unique
--   ON public.companions (canonical_key)
--   WHERE canonical_key IS NOT NULL AND canonical_key <> '';
