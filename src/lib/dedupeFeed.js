// Collapse only literal reposts of the same name within a short window — NOT
// the entire history. A whole-history collapse (the previous behavior) turned
// "every post that arrives" into a second directory — one card per business,
// ever — which is exactly what made the live tab feel redundant with the
// curated grid. A 2h window still absorbs channel-crosspost spam while keeping
// the feed genuinely chronological: a shop posting again today shows again today.

export const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

export function dedupeFeed(feed) {
  const sorted = [...feed].sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate));
  const representative = new Map(); // key -> { at, card } standing in for this run
  const out = [];
  for (const item of sorted) {
    const key = (item.name || '').toLowerCase().trim().replace(/[\s\u200B]+/g, ' ');
    if (!key || key.length < 2) { out.push({ ...item, postCount: 1 }); continue; }
    const thisTime = new Date(item.messageDate).getTime();
    const prev = representative.get(key);
    // Window is anchored to the representative card, not the previous item, so a
    // chain of sub-window gaps can't silently swallow posts hours apart.
    if (prev && prev.at - thisTime < DEDUPE_WINDOW_MS) {
      prev.card.postCount += 1;
      continue;
    }
    const card = { ...item, postCount: 1 };
    representative.set(key, { at: thisTime, card });
    out.push(card);
  }
  return out;
}
