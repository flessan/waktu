// src/index.js
// Minimal single-file server: calendar + Wikipedia OnThisDay
// Requires Node >=18 (for global fetch) or adjust to use node-fetch

const express = require('express');
const path = require('path');
const dayjs = require('dayjs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // jika ada folder public

const PORT = process.env.PORT || 3000;
const USER_AGENT = process.env.USER_AGENT || 'waktu-redesign/1.0 (contact: your-email@example.com)';

// helper: validate date string (YYYY-MM-DD)
function parseDate(qdate) {
  const d = qdate ? dayjs(qdate, 'YYYY-MM-DD', true) : dayjs();
  return d.isValid() ? d : null;
}

// GET /calendar?date=YYYY-MM-DD
app.get('/calendar', (req, res) => {
  const date = parseDate(req.query.date);
  if (!date) return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });

  const calendar = {
    iso: date.format('YYYY-MM-DD'),
    year: Number(date.format('YYYY')),
    month: Number(date.format('M')),
    monthName: date.format('MMMM'),
    day: Number(date.format('D')),
    weekday: date.format('dddd'),
    weekdayShort: date.format('ddd'),
    timestamp: date.toISOString()
  };

  res.json(calendar);
});

// GET /onthisday?date=YYYY-MM-DD&type=all|events|births|deaths|holidays
app.get('/onthisday', async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const date = parseDate(req.query.date);
    if (!date) return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });

    const mm = date.format('MM');
    const dd = date.format('DD');
    const endpoint = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/${encodeURIComponent(type)}/${mm}/${dd}`;

    const fetchRes = await fetch(endpoint, { headers: { 'User-Agent': USER_AGENT } });
    if (!fetchRes.ok) {
      const txt = await fetchRes.text().catch(()=>null);
      return res.status(fetchRes.status).json({ error: 'wikipedia_api_error', details: txt || `status ${fetchRes.status}` });
    }

    const data = await fetchRes.json();
    res.json({ date: date.format('YYYY-MM-DD'), type, source: endpoint, data });
  } catch (err) {
    console.error('onthisday error', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
});

// GET /today?date=YYYY-MM-DD
// Returns calendar + wiki (all)
app.get('/today', async (req, res) => {
  try {
    const date = parseDate(req.query.date);
    if (!date) return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });

    const calendar = {
      iso: date.format('YYYY-MM-DD'),
      year: Number(date.format('YYYY')),
      month: Number(date.format('M')),
      monthName: date.format('MMMM'),
      day: Number(date.format('D')),
      weekday: date.format('dddd'),
      weekdayShort: date.format('ddd')
    };

    const mm = date.format('MM');
    const dd = date.format('DD');
    const wikiUrl = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`;

    let wiki = null;
    try {
      const r = await fetch(wikiUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (r.ok) wiki = await r.json();
      else {
        const txt = await r.text().catch(()=>null);
        wiki = { error: 'wikipedia_api_error', details: txt || `status ${r.status}` };
      }
    } catch (we) {
      wiki = { error: 'fetch_failed', details: we.message };
    }

    res.json({ calendar, wiki });
  } catch (err) {
    console.error('today error', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
});

// fallback root: small info (keeps existing behavior predictable)
app.get('/', (req, res) => {
  res.json({
    name: 'waktu (modified)',
    description: 'Calendar + Wikipedia On This Day (modified src/index.js)',
    routes: [
      { path: '/calendar?date=YYYY-MM-DD', desc: 'Gregorian calendar info' },
      { path: '/onthisday?date=YYYY-MM-DD&type=all|events|births|deaths|holidays', desc: 'Wikipedia On This Day' },
      { path: '/today?date=YYYY-MM-DD', desc: 'Combined calendar + wiki' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
