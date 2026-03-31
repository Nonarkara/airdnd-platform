-- BI Enrichment: capture ALL data from Telegram channels
-- Adds business intelligence columns to companions + raw message archive

-- === Extend companions table ===
ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS source_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discussion_notes TEXT,
  ADD COLUMN IF NOT EXISTS user_feedback JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_rating NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS service_tags JSONB DEFAULT '[]'::jsonb;

-- === Raw message archive (BI gold mine) ===
CREATE TABLE IF NOT EXISTS public.channel_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_message_id BIGINT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    sender_id TEXT,
    message_text TEXT,
    message_date TIMESTAMPTZ,
    has_media BOOLEAN DEFAULT FALSE,
    media_type TEXT,
    photo_url TEXT,
    reply_to_message_id BIGINT,
    grouped_id TEXT,
    cluster_id INTEGER,
    message_type TEXT NOT NULL DEFAULT 'unknown',
    linked_companion_id BIGINT REFERENCES public.companions(id) ON DELETE SET NULL,
    raw_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_date ON public.channel_messages (message_date DESC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_type ON public.channel_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON public.channel_messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_companion ON public.channel_messages (linked_companion_id);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend pipelines)
CREATE POLICY "service_role_all_channel_messages"
    ON public.channel_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read (admin dashboard)
CREATE POLICY "authenticated_select_channel_messages"
    ON public.channel_messages
    FOR SELECT
    TO authenticated
    USING (true);
