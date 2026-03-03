import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Serve built assets directly, but let the SPA shell route through the fallback below.
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// Keep the mutable snapshot and other public assets available at runtime.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Any request that doesn't match a static file gets routed back to React's index.html
app.use((req, res) => {
    const indexHtml = path.join(__dirname, 'dist', 'index.html');
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
