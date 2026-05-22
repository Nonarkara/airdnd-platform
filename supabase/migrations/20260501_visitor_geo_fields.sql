-- Extend anonymous visitor telemetry with coarse network/location fields.
-- These fields are collected without names, emails, or account identifiers.
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS org TEXT;

CREATE INDEX IF NOT EXISTS idx_page_views_country_city
  ON public.page_views (country, city);
