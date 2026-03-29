-- Visitor tracking: page views, listing clicks, session events
CREATE TABLE IF NOT EXISTS public.page_views (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL,
    page TEXT NOT NULL DEFAULT '/',
    referrer TEXT,
    user_agent TEXT,
    language TEXT,
    screen_w SMALLINT,
    screen_h SMALLINT,
    country TEXT,
    city TEXT,
    latitude REAL,
    longitude REAL,
    listing_id BIGINT REFERENCES public.companions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL DEFAULT 'pageview',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_session_id ON public.page_views (session_id);
CREATE INDEX idx_page_views_event_type ON public.page_views (event_type);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anon users can INSERT (visitors recording page views)
CREATE POLICY "anon_insert_page_views"
    ON public.page_views
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Authenticated users can SELECT (admin dashboard)
CREATE POLICY "authenticated_select_page_views"
    ON public.page_views
    FOR SELECT
    TO authenticated
    USING (true);
