import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson } from '../scripts/listing_pipeline.js';

// The local-model transport (Ollama /v1/chat/completions with a json_object
// response mode) sometimes returns one bare object instead of the requested
// array. parseModelJson must accept both shapes or every local enrichment is
// silently dropped.

test('parseModelJson passes arrays through unchanged', () => {
  const parsed = parseModelJson('[{"cluster_id":0,"name":"A"}]');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'A');
});

test('parseModelJson unwraps {listings:[...]} envelopes', () => {
  const parsed = parseModelJson('{"listings":[{"cluster_id":0,"name":"B"}]}');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'B');
});

test('parseModelJson wraps a bare object as a single item', () => {
  const parsed = parseModelJson('{"cluster_id":"0","name":"สบายดี","phone":"0812345678"}');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].phone, '0812345678');
});

test('parseModelJson rejects non-objects', () => {
  assert.deepEqual(parseModelJson('"just a string"'), []);
  assert.deepEqual(parseModelJson('42'), []);
});
