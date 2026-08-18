import { useEffect, useRef, useState } from 'react';

/**
 * Shared progressive-image loader for ListingCard + FeedCard.
 *
 * Before this, ListingCard had its own two-step retry-then-letter-avatar
 * chain and FeedCard had nothing — a plain <img> with no onError, so any
 * broken URL just sat there as the browser's broken-image icon forever.
 * One implementation now, used by both.
 *
 * Also fixes the "photos don't show up" perception bug: the placeholder
 * behind a pending <img loading="lazy"> was a near-black flat fill that
 * matched the page background almost exactly, so a still-loading photo
 * was visually indistinguishable from an intentionally-absent one. This
 * hook exposes `isLoading` so callers can render a visible pulse instead.
 */
export function useCardPhoto(urls) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const firstUrl = list[0] || null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const prevFirst = useRef(firstUrl);

  useEffect(() => {
    if (prevFirst.current !== firstUrl) {
      prevFirst.current = firstUrl;
      setAttempt(0);
      setLoaded(false);
    }
  }, [firstUrl]);

  const exhausted = list.length === 0 || attempt >= list.length;
  const src = exhausted ? null : list[attempt];

  return {
    src,
    isLoading: Boolean(src) && !loaded,
    isFailed: exhausted && list.length > 0,
    onLoad: () => setLoaded(true),
    onError: () => setAttempt((a) => a + 1),
  };
}
