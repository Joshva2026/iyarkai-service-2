import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = '0.0.0.0';

// In-memory cache for geocoding queries (1 hour TTL)
const geocodeCache = new Map();

// Reverse geocoding proxy endpoint
app.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const roundedLat = parseFloat(lat).toFixed(4);
  const roundedLon = parseFloat(lon).toFixed(4);
  const cacheKey = `rev:${roundedLat}:${roundedLon}`;

  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return res.json(cached.data);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IyarkaiAmbulanceService/1.0 (contact: support@iyarkaiservice.in)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      throw new Error(`Nominatim responded with status ${response.status}`);
    }

    const data = await response.json();
    geocodeCache.set(cacheKey, { timestamp: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    res.status(502).json({ error: 'Geocoding service unavailable', details: err.message });
  }
});

// Search address forward geocoding proxy endpoint
app.get('/api/search-address', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const cleanQuery = q.trim().toLowerCase();
  const cacheKey = `search:${cleanQuery}`;

  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return res.json(cached.data);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=6&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IyarkaiAmbulanceService/1.0 (contact: support@iyarkaiservice.in)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      throw new Error(`Nominatim responded with status ${response.status}`);
    }

    const data = await response.json();
    geocodeCache.set(cacheKey, { timestamp: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error('Search address error:', err.message);
    res.status(502).json({ error: 'Search service unavailable', details: err.message });
  }
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
