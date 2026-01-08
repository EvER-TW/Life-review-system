import express from 'express';
import cors from 'cors';
import { getValue, setValue } from './google-sheets.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080; // Cloud Run default is 8080 usually
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large data
app.use(express.static(__dirname));

// Generic Storage API
app.get('/api/storage/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const data = await getValue(key);
        // If data is null, return 404 or just null?
        // Frontend expects default value if null.
        // Let's return JSON { data: ... }
        res.json({ data });
    } catch (error) {
        console.error('GET Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/storage/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { data } = req.body; // Expect { data: ... }
        await setValue(key, data);
        res.json({ success: true });
    } catch (error) {
        console.error('POST Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Prevent recursive index.html loading for missing pages
app.get('/pages/*', (req, res) => {
    res.status(404).send('Page not found');
});

// Serve index.html for unknown routes (SPA fallback)
app.get('*', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).end();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
