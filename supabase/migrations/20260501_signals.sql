-- Phase 1: Demand signals — capture visitor intent (save, inquire, share)
-- Structurally identical to page_views; semantically different (intentional actions, not passive views)

CREATE TABLE IF NOT EXISTS public.signals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL,
  listing_id BIGINT REFERENCES public.companions(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  country TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_signals_listing ON public.signals(listing_id);
CREATE INDEX idx_signals_type ON public.signals(signal_type);
CREATE INDEX idx_signals_created ON public.signals(created_at DESC);
CREATE INDEX idx_signals_session ON public.signals(session_id);

-- Constraint: valid signal types only
ALTER TABLE public.signals ADD CONSTRAINT chk_signal_type
  CHECK (signal_type IN ('save', 'inquire', 'share'));

-- RLS: same pattern as page_views — anonymous INSERT, authenticated SELECT
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert signals"
  ON public.signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read signals"
  ON public.signals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Grant anon user INSERT access
GRANT INSERT ON public.signals TO anon;
GRANT SELECT ON public.signals TO authenticated;
GRANT USAGE ON SEQUENCE public.signals_id_seq TO anon;

COMMENT ON TABLE public.signals IS 'Demand signals: visitor-initiated actions (save, inquire, share) distinct from passive page views';
