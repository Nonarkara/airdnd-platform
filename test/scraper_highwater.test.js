import { test } from 'node:test';
import assert from 'node:assert';
import { extractListingsFromTarget } from '../scripts/telegram_scraper.js';

const fakeTarget = (token = 'ch1') => ({
  token,
  displayLabel: `@${token}`,
  fetchRef: token,
});

// Regression fix #1 (2026-09-08): the high-water mark must NEVER advance when
// processing fails. It used to be committed before clustering/photo-download/
// archive, so an unhandled throw marked the whole batch consumed and the next
// cycle fetched only `> lastSeen` — the failed batch was lost forever.
test('extractListingsFromTarget does not advance mark when fetch fails', async () => {
  const target = fakeTarget('failchannel');
  const state = { lastSeenMessageIds: { [target.token]: 41 }, intakeGaps: {} };
  const failingClient = {
    getMessages: async () => {
      throw new Error('Telegram API unreachable');
    },
  };

  await assert.rejects(
    extractListingsFromTarget(failingClient, target, state),
    /Telegram API unreachable/,
  );

  // The window boundary must still point at the last successfully processed
  // message so the batch is re-fetched next cycle — never skipped.
  assert.strictEqual(
    state.lastSeenMessageIds[target.token],
    41,
    'high-water mark must not advance when processing fails',
  );
});

// Regression fix #1 (2026-09-08): a message window that IS processed to
// completion must still advance the mark even when nothing extractable comes
// out of it — otherwise an all-junk window is re-fetched forever and stalls
// the channel. The fetch succeeds, clustering runs and finds only non-text/
// non-media content, and the empty-result early-return advances the mark.
test('extractListingsFromTarget advances mark when the window is processed but yields nothing', async () => {
  const target = fakeTarget('latefail');
  const state = { lastSeenMessageIds: { [target.token]: 7 }, intakeGaps: {} };
  const client = {
    getMessages: async () => [
      {
        id: 9,
        date: Math.floor(Date.now() / 1000),
        message: 'นวดแผนไทย 1000 บาท เบอร์โทร 0891234567',
        fromId: { userId: 555 },
        out: false,
      },
    ],
  };

  const result = await extractListingsFromTarget(client, target, state);
  assert.ok(Array.isArray(result.listings));
  assert.ok(
    (state.lastSeenMessageIds[target.token] || 0) >= 9,
    'mark should advance when the window completed without throwing',
  );
});

// Success path: mark advances to the latest fetched id.
test('extractListingsFromTarget advances mark to latest id on success', async () => {
  const target = fakeTarget('okchannel');
  const state = { lastSeenMessageIds: {}, intakeGaps: {} };
  const client = {
    getMessages: async () => [
      {
        id: 12,
        date: Math.floor(Date.now() / 1000),
        text: 'hello world',
        fromId: { userId: 1 },
        out: false,
      },
    ],
  };

  await extractListingsFromTarget(client, target, state);
  assert.ok(
    (state.lastSeenMessageIds[target.token] || 0) >= 12,
    'mark must advance to the latest fetched message id on success',
  );
});