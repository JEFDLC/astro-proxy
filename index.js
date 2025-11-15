const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE_URL = 'https://json.astrologyapi.com/v1';
const API_USER_ID  = process.env.ASTRO_USER_ID;   // op Render invullen
const API_KEY      = process.env.ASTRO_API_KEY;   // op Render invullen

if (!API_USER_ID || !API_KEY) {
  console.warn('⚠️ ASTRO_USER_ID / ASTRO_API_KEY niet ingesteld als env vars.');
}

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// simpele in-memory cache
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24u

function makeKey(service, body) {
  return service + ':' + JSON.stringify(body);
}

function setCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Proxy voor western_horoscope
app.post('/western_horoscope', async (req, res) => {
  try {
    if (!API_USER_ID || !API_KEY) {
      return res.status(500).json({ error: 'ASTRO_USER_ID/ASTRO_API_KEY niet ingesteld.' });
    }

    const body = req.body || {};
    const key = makeKey('western_horoscope', body);
    const cached = getCache(key);
    if (cached) {
      return res.json(cached);
    }

    const auth = Buffer.from(API_USER_ID + ':' + API_KEY).toString('base64');

    const response = await fetch(API_BASE_URL + '/western_horoscope', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return res.status(response.status).send(text);
    }

    if (!response.ok) {
      return res.status(response.status).json(json);
    }

    setCache(key, json);
    res.json(json);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// eventueel later /western_chart_data op dezelfde manier proxien

app.listen(PORT, () => {
  console.log(`Astro proxy listening on port ${PORT}`);
});
