/**
 * Unit tests for the OTOP universe knowledge graph.
 *
 * Pure helpers in otop/core/universe.js are tested directly. The built
 * artefact otop/public/otop_graph.json is tested for shape when present
 * (build-stage test, skipped otherwise — same pattern as the anchors test).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeId, layoutUniverse, filterUniverse, danglingEdges, KIND_LAYER, LAYERS } from '../otop/core/universe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── nodeId ───────────────────────────────────────────────────────

test('nodeId namespaces kind and key', () => {
  assert.equal(nodeId('province', 10), 'province:10');
  assert.equal(nodeId('category', 'food'), 'category:food');
});

// ── KIND_LAYER covers every ring kind ────────────────────────────

test('every layout ring kind has a layer', () => {
  for (const kind of ['root', 'region', 'province', 'category', 'basin', 'year', 'era', 'revenue', 'agency', 'standard']) {
    assert.ok(KIND_LAYER[kind], `kind ${kind} has a layer`);
    assert.ok(LAYERS.includes(KIND_LAYER[kind]) || kind === 'root', `layer ${KIND_LAYER[kind]} is known`);
  }
});

// ── layoutUniverse ───────────────────────────────────────────────

test('layoutUniverse centers the root and rings the rest deterministically', () => {
  const nodes = [
    { id: 'root:otop', kind: 'root' },
    { id: 'region:north', kind: 'region' },
    { id: 'region:south', kind: 'region' },
    { id: 'province:10', kind: 'province' },
  ];
  const a = layoutUniverse(nodes, 900, 620);
  const b = layoutUniverse(nodes, 900, 620);
  assert.deepEqual(a.get('root:otop'), { x: 450, y: 310 });
  assert.deepEqual([...a.entries()], [...b.entries()]);
  assert.equal(a.size, 4);
});

// ── filterUniverse ───────────────────────────────────────────────

test('filterUniverse keeps root and drops edges to removed layers', () => {
  const graph = {
    nodes: [
      { id: 'root:otop', kind: 'root' },
      { id: 'province:10', kind: 'province' },
      { id: 'year:2022', kind: 'year' },
    ],
    edges: [
      { s: 'root:otop', t: 'province:10', w: 5, kind: 'contains' },
      { s: 'year:2022', t: 'province:10', w: 2, kind: 'filed' },
    ],
  };
  const out = filterUniverse(graph, ['business']);
  assert.equal(out.nodes.length, 2);
  assert.equal(out.edges.length, 1);
  assert.equal(out.edges[0].kind, 'contains');
});

// ── danglingEdges ────────────────────────────────────────────────

test('danglingEdges finds endpoints with no node', () => {
  const graph = {
    nodes: [{ id: 'root:otop', kind: 'root' }],
    edges: [{ s: 'root:otop', t: 'province:99', w: 1, kind: 'contains' }],
  };
  assert.equal(danglingEdges(graph).length, 1);
  assert.equal(danglingEdges({ nodes: graph.nodes, edges: [] }).length, 0);
});

// ── built artefact ───────────────────────────────────────────────

test('otop_graph.json has 100+ nodes, 100+ edges, no dangling edges', () => {
  const file = path.join(__dirname, '../otop/public/otop_graph.json');
  if (!fs.existsSync(file)) return; // build stage test
  const graph = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(graph.nodes.length > 100, `nodes ${graph.nodes.length}`);
  assert.ok(graph.edges.length > 100, `edges ${graph.edges.length}`);
  assert.equal(danglingEdges(graph).length, 0);
  const kinds = new Set(graph.nodes.map((d) => d.kind));
  for (const k of ['root', 'region', 'province', 'category', 'agency', 'year']) {
    assert.ok(kinds.has(k), `graph has ${k} nodes`);
  }
});
