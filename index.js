// server.js — SWISS astro proxy via AstrologyAPI

const express = require('express');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());

// Healthcheck + env-check
app.get('/ping', (req, res) => {
  res.json({
    ok: true,
    service: 'astro-proxy',
    env: {
      ASTRO_USER_ID: !!process.env.ASTRO_USER_ID,
      ASTRO_API_KEY: !!process.env.ASTRO_API_KEY
    },
    time: new Date().toISOString()
  });
});

// Proxy route voor western_horoscope
app.post('/western_horoscope', async (req, res) => {
  const userId = process.env.ASTRO_USER_ID;
  const apiKey = process.env.ASTRO_API_KEY;

  if (!userId || !apiKey) {
    return res.status(500).json({
      error: 'ASTRO_USER_ID/ASTRO_API_KEY niet ingesteld.',
      have: {
        ASTRO_USER_ID: !!userId,
        ASTRO_API_KEY: !!apiKey
      }
    });
  }

  try {
    const auth = Buffer.from(userId + ':' + apiKey).toString('base64');

    const upstream = await fetch(
      'https://json.astrologyapi.com/v1/western_horoscope',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      }
    );

    const text = await upstream.text();
    res.status(upstream.status);

    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch (e) {
      res.type('application/json');
      return res.send(text);
    }
  } catch (err) {
    console.error('PROXY ERROR', err);
    return res.status(500).json({
      error: 'PROXY_ERROR',
      message: err.message || String(err)
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log('Astro proxy luistert op poort', port);
});

