import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

function resolveSnapshotPath() {
    const publicSnapshotPath = path.join(publicDir, 'data.json');
    const distSnapshotPath = path.join(distDir, 'data.json');
    const existingPaths = [publicSnapshotPath, distSnapshotPath].filter((candidate) => fs.existsSync(candidate));

    if (existingPaths.length === 0) {
        return null;
    }

    return existingPaths.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

app.get('/data.json', (req, res) => {
    const snapshotPath = resolveSnapshotPath();
    if (!snapshotPath) {
        res.status(404).json({ error: 'Snapshot file not found.' });
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Production Express server running on port ${PORT}`);
});
