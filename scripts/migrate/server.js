#!/usr/bin/env node
/**
 * server.js — Hono API server for Sabai Sabai on M3.
 * Serves listings, photos, analytics to the Cloudflare Pages frontend.
 *
 * Run: node scripts/migrate/server.js
 * Requires: PostgreSQL on M3 (DATABASE_URL), 8TB drive mounted at /Volumes/SabaiSabai
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sabai:sabai@localhost:5432/sabai';
const PORT = parseInt(process.env.PORT || '3001');
const PHOTO_ROOT = process.env.PHOTO_ROOT || '/Volumes/SabaiSabai/photos';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const app = new Hono();
app.use('*', cors());

// ── Listings ────────────────────────────────────────────────────────────────
app.get('/api/listings', async (c) => {
  const { city, channel, tier, limit = '200', offset = '0' } = c.req.query();
  let query = 'SELECT * FROM companions WHERE 1=1';
  const params = [];
  let i = 1;

  if (city) { query += ` AND city = $${i++}`; params.push(city); }
  if (channel) { query += ` AND source_channel = $${i++}`; params.push(channel); }
  if (tier) { query += ` AND compliance_tier = $${i++}`; params.push(tier); }

  query += ` ORDER BY updated_at DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await pool.query(query, params);
  return c.json(rows);
});

app.get('/api/listings/:id', async (c) => {
  const { rows } = await pool.query('SELECT * FROM companions WHERE id = $1', [c.req.param('id')]);
  return c.json(rows[0] || null);
});

// ── Photos ──────────────────────────────────────────────────────────────────
app.get('/api/photos/:listingId', async (c) => {
  const { rows } = await pool.query(
    'SELECT * FROM photo_archive WHERE linked_companion_id = $1 ORDER BY message_date DESC',
    [c.req.param('listingId')],
  );
  return c.json(rows);
});

// Serve photo files from 8TB drive
app.get('/files/photos/:filename', async (c) => {
  const filePath = path.join(PHOTO_ROOT, c.req.param('filename'));
  if (!fs.existsSync(filePath)) return c.notFound();
  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
  });
});

// ── Analytics ───────────────────────────────────────────────────────────────
app.get('/api/analytics/summary', async (c) => {
  const [listings, channels, districts, tiers] = await Promise.all([
    pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT city) as cities FROM companions'),
    pool.query('SELECT source_channel, COUNT(*) as count FROM companions GROUP BY source_channel ORDER BY count DESC LIMIT 10'),
    pool.query('SELECT city, COUNT(*) as count FROM companions WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 20'),
    pool.query('SELECT compliance_tier, COUNT(*) as count FROM companions GROUP BY compliance_tier ORDER BY count DESC'),
  ]);

  return c.json({
    totalListings: parseInt(listings.rows[0].total),
    totalCities: parseInt(listings.rows[0].cities),
    topChannels: channels.rows,
    topCities: districts.rows,
    tierBreakdown: tiers.rows,
  });
});

app.get('/api/analytics/timeline', async (c) => {
  const { days = '30' } = c.req.query();
  const { rows } = await pool.query(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM companions
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `);
  return c.json(rows);
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', async (c) => {
  const { rows } = await pool.query('SELECT COUNT(*) as listings FROM companions');
  return c.json({ status: 'ok', listings: parseInt(rows[0].listings), uptime: process.uptime() });
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Sabai Sabai API running on http://localhost:${info.port}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] || '(local)'}`);
  console.log(`Photos: ${PHOTO_ROOT}`);
});