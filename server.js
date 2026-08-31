import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHealthReport } from './src/lib/server_health.js';
import { handleCivicAdsbProxy } from './src/lib/civicLive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

function resolveMutablePublicPath(filename) {
    const publicSnapshotPath = path.join(publicDir, filename);
    const distSnapshotPath = path.join(distDir, filename);
    const existingPaths = [publicSnapshotPath, distSnapshotPath].filter((candidate) => fs.existsSync(candidate));

    if (existingPaths.length === 0) {
        return null;
    }

    return existingPaths.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

app.get(['/data.json', '/feed.json'], (req, res) => {
    const snapshotPath = resolveMutablePublicPath(path.basename(req.path));
    if (!snapshotPath) {
        res.status(404).json({ error: 'Public data file not found.' });
        return;
    }

    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
    });
    res.sendFile(snapshotPath);
});

app.get('/health', (req, res) => {
    const report = createHealthReport({ rootDir: __dirname, distDir, publicDir });
    res.set('Cache-Control', 'no-store');
    res.status(report.ok ? 200 : 503).json(report);
});

app.get('/api/civic/adsb', (req, res) => {
    handleCivicAdsbProxy(req, res);
});

// Serve built assets directly, but let the SPA shell route through the fallback below.
app.use(express.static(distDir, { index: false }));

// Keep the mutable snapshot and other public assets available at runtime.
app.use(express.static(publicDir, { index: false }));

// Any request that doesn't match a static file gets routed back to React's index.html
app.use((req, res) => {
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
        res.set('Cache-Control', 'no-store');
        res.sendFile(indexHtml);
    } else {
        res.status(404).send('Not Found. Make sure to run `npm run build` before starting the server.');
    }
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Production Express server running on port ${PORT}`);
    });
}

export default app;
